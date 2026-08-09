import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import { SAMPLE_GUARDS } from "./sample-guards";

const QUESTION_RE =
  /(\?|how do i|how can i|what should|why does|anyone else|is it normal)/i;
const PAIN_RE =
  /(stuck|confused|overwhelmed|don't know|dont know|struggling|afraid|worried)/i;
const REQUEST_RE =
  /(can you make|please cover|do a video|part 2|follow.?up|tutorial on)/i;

const clusterSchema = z.object({
  clusters: z.array(
    z.object({
      insight_type: z.enum([
        "question",
        "pain_point",
        "desire",
        "objection",
        "misconception",
        "content_request",
        "language_pattern",
        "debate",
        "follow_up_opportunity",
      ]),
      summary: z.string(),
      sample_phrases: z.array(z.string()),
      confidence: z.enum(["low", "medium", "high"]),
    }),
  ),
});

/**
 * Deterministic audience insight extraction from stored comments,
 * optionally refined with CHEAP model clustering when OpenRouter is available.
 */
export async function refreshAudienceInsights(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<number> {
  const { data: comments } = await params.supabase
    .from("audience_comments")
    .select("id, body, post_id")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!comments?.length) return 0;

  const buckets = {
    question: [] as typeof comments,
    pain_point: [] as typeof comments,
    content_request: [] as typeof comments,
  };

  for (const comment of comments) {
    if (REQUEST_RE.test(comment.body)) buckets.content_request.push(comment);
    else if (QUESTION_RE.test(comment.body)) buckets.question.push(comment);
    else if (PAIN_RE.test(comment.body)) buckets.pain_point.push(comment);
  }

  let created = 0;
  for (const [type, rows] of Object.entries(buckets) as Array<
    [keyof typeof buckets, typeof comments]
  >) {
    if (rows.length < SAMPLE_GUARDS.audienceInsightMinMentions) continue;
    const summary =
      type === "question"
        ? `Audience repeatedly asks questions (${rows.length} comments). Top: “${rows[0]!.body.slice(0, 80)}”`
        : type === "pain_point"
          ? `Audience expresses recurring friction (${rows.length} comments).`
          : `Audience requests follow-up content (${rows.length} comments).`;

    const { data: existing } = await params.supabase
      .from("audience_insights")
      .select("id")
      .eq("user_id", params.userId)
      .eq("insight_type", type)
      .eq("status", "active")
      .ilike("summary", summary.slice(0, 40) + "%")
      .maybeSingle();

    if (existing) continue;

    await params.supabase.from("audience_insights").insert({
      user_id: params.userId,
      insight_type: type,
      summary,
      evidence: {
        comment_ids: rows.slice(0, 20).map((r) => r.id),
        samples: rows.slice(0, 5).map((r) => r.body.slice(0, 160)),
      },
      source_post_ids: Array.from(
        new Set(rows.map((r) => r.post_id).filter(Boolean)),
      ),
      sample_size: rows.length,
      confidence: rows.length >= 8 ? "high" : rows.length >= 3 ? "medium" : "low",
      status: "active",
    });
    created += 1;

    // Audience language snippets (best-effort; unique index may skip dupes)
    for (const row of rows.slice(0, 5)) {
      const phrase = row.body.trim().slice(0, 120);
      if (phrase.length < 12) continue;
      const { error } = await params.supabase.from("audience_language").insert({
        user_id: params.userId,
        phrase,
        category: "phrase",
        frequency: 1,
      });
      void error;
    }
  }

  // CHEAP model may add broader clusters from authentic wording
  const samples = comments.slice(0, 40).map((c) => c.body.slice(0, 180));
  if (samples.length >= SAMPLE_GUARDS.audienceInsightMinMentions) {
    const cacheKey = hashAiInput(["audience-cluster-v1", samples]);
    const clustered = await tryStructuredAI({
      supabase: params.supabase,
      fallback: { clusters: [] },
      input: {
        userId: params.userId,
        taskType: "audience_analysis",
        role: "cheap",
        promptVersion: "audience-cluster-v1",
        cacheKey,
        maxOutputTokens: 800,
        schema: clusterSchema,
        messages: [
          {
            role: "system",
            content:
              "Cluster creator audience comments. Prefer authentic wording over polished marketing language. Return JSON { clusters: [{ insight_type, summary, sample_phrases, confidence }] }. insight_type must be one of: question, pain_point, desire, objection, misconception, content_request, language_pattern, debate, follow_up_opportunity. Do not invent private user identities.",
          },
          {
            role: "user",
            content: JSON.stringify({ comments: samples }),
          },
        ],
      },
    });

    if (clustered.usedLlm) {
      for (const cluster of clustered.data.clusters.slice(0, 5)) {
        if (cluster.sample_phrases.length < 1) continue;
        const { data: existing } = await params.supabase
          .from("audience_insights")
          .select("id")
          .eq("user_id", params.userId)
          .eq("insight_type", cluster.insight_type)
          .eq("status", "active")
          .ilike("summary", `${cluster.summary.slice(0, 40)}%`)
          .maybeSingle();
        if (existing) continue;

        await params.supabase.from("audience_insights").insert({
          user_id: params.userId,
          insight_type: cluster.insight_type,
          summary: cluster.summary.slice(0, 500),
          evidence: {
            samples: cluster.sample_phrases.slice(0, 8),
            source: "cheap_llm_cluster",
          },
          source_post_ids: [],
          sample_size: cluster.sample_phrases.length,
          confidence: cluster.confidence,
          status: "active",
        });
        created += 1;

        for (const phrase of cluster.sample_phrases.slice(0, 3)) {
          if (phrase.trim().length < 12) continue;
          const { error } = await params.supabase
            .from("audience_language")
            .insert({
              user_id: params.userId,
              phrase: phrase.trim().slice(0, 120),
              category: "phrase",
              frequency: 1,
            });
          void error;
        }
      }
    }
  }

  return created;
}
