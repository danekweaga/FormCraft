"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ingestPublicVideoUrl } from "@/lib/analyze/ingest/url";
import { buildFormCraftContext } from "@/lib/ai/context/formcraft-context";
import {
  evaluateIdeaWithContext,
  toDbRecommendation,
} from "@/lib/growth/idea-gate-intelligence";
import { ideaGateSchema } from "@/lib/growth/schemas";
import { analyzeResearchBatch } from "@/lib/research/analyze";
import { generateIdeasFromOutlier } from "@/lib/research/generate-ideas";
import type { ResearchPlatform, ScoredResearchVideo } from "@/lib/research/types";
import { createClient } from "@/lib/supabase/server";

export type IdeaGateActionState = {
  error?: string;
  success?: boolean;
  successMessage?: string;
  evaluationId?: string;
};

function identifyReference(rawUrl: string): {
  platform: ResearchPlatform;
  externalId: string;
  normalizedUrl: string;
} {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Paste a full Instagram, TikTok, or YouTube video URL.");
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host.includes("instagram.com")) {
    const match = url.pathname.match(/\/(reel|p|tv)\/([^/?#]+)/i);
    if (!match?.[2]) {
      throw new Error("Instagram link must be a /reel/ or /p/ post URL.");
    }
    return {
      platform: "instagram",
      externalId: match[2],
      normalizedUrl: url.toString(),
    };
  }
  if (host.includes("tiktok.com") || host === "vm.tiktok.com") {
    const match = url.pathname.match(/\/video\/(\d+)/);
    const externalId =
      match?.[1] ??
      createHash("sha256").update(url.toString()).digest("hex").slice(0, 24);
    return {
      platform: "tiktok",
      externalId,
      normalizedUrl: url.toString(),
    };
  }
  if (
    host.includes("youtube.com") ||
    host === "youtu.be" ||
    host.includes("youtube-nocookie.com")
  ) {
    const id =
      url.searchParams.get("v") ||
      (host === "youtu.be" ? url.pathname.replace(/^\//, "") : null) ||
      url.pathname.match(/\/shorts\/([^/?#]+)/)?.[1];
    if (!id) throw new Error("YouTube link must include a video id.");
    return {
      platform: "youtube",
      externalId: id,
      normalizedUrl: `https://www.youtube.com/watch?v=${id}`,
    };
  }
  throw new Error("Supported platforms: Instagram, TikTok, or YouTube.");
}

export async function evaluateIdea(
  _prev: IdeaGateActionState,
  formData: FormData,
): Promise<IdeaGateActionState> {
  const parsed = ideaGateSchema.safeParse({
    ideaText: formData.get("ideaText"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid idea." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const context = await buildFormCraftContext(supabase, {
    userId: user.id,
    taskType: "idea_evaluation",
    query: parsed.data.ideaText,
  });

  const [{ data: priorPosts }, { data: priorIdeas }] = await Promise.all([
    supabase
      .from("content_posts")
      .select("title, caption")
      .eq("user_id", user.id)
      .limit(40),
    supabase
      .from("idea_gate_evaluations")
      .select("idea_text")
      .eq("user_id", user.id)
      .limit(40),
  ]);

  const priorTexts = [
    ...(priorPosts ?? []).map((p) => `${p.title ?? ""} ${p.caption ?? ""}`),
    ...(priorIdeas ?? []).map((i) => i.idea_text),
  ];

  const decision = await evaluateIdeaWithContext({
    idea: parsed.data.ideaText,
    context,
    priorTexts,
    supabase,
    userId: user.id,
  });

  const { data, error } = await supabase
    .from("idea_gate_evaluations")
    .insert({
      user_id: user.id,
      idea_text: parsed.data.ideaText,
      recommendation: toDbRecommendation(decision.recommendation),
      why: `${decision.summary}\n\nDecision: ${decision.recommendation}`,
      evidence: decision.evidence.map((label) => ({ label })),
      risks: decision.weaknesses.map((label) => ({ label })),
      missing_ingredient: decision.requiredPersonalContext[0] ?? null,
      better_angle: decision.suggestedAngle,
      best_format: decision.suggestedFormat,
      status: "evaluated",
      related_ids: {
        decision,
        sourcesUsed: decision.sourcesUsed,
        contextDebug: context.debug,
      },
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/idea-gate");
  return { success: true, evaluationId: data.id };
}

/** Paste a public video link → save research evidence → generate + gate an original idea. */
export async function evaluateIdeaFromVideoLink(
  _prev: IdeaGateActionState,
  formData: FormData,
): Promise<IdeaGateActionState> {
  const rawUrl = String(formData.get("videoUrl") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000);
  if (!rawUrl) {
    return { error: "Paste an Instagram, TikTok, or YouTube video link." };
  }

  let reference: ReturnType<typeof identifyReference>;
  try {
    reference = identifyReference(rawUrl);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid URL." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const video: ScoredResearchVideo = {
    platform: reference.platform,
    externalId: reference.externalId,
    externalUrl: reference.normalizedUrl,
    creatorId: null,
    creatorName: null,
    title: notes.slice(0, 120) || null,
    description: notes || null,
    thumbnailUrl: null,
    publishedAt: null,
    durationSeconds: null,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    baselineViews: null,
    outlierScore: null,
    scoreBasis: "unavailable",
  };

  const transcriptsByExternalId = new Map<string, string>();
  let transcript = "";
  let transcriptProvider: string | null = null;
  let transcriptLanguage: string | null = null;
  let transcriptSegments: unknown[] = [];

  const ingested = await ingestPublicVideoUrl(reference.normalizedUrl);
  if (ingested.ok) {
    transcript = ingested.transcript;
    transcriptProvider = ingested.transcriptProvider;
    transcriptLanguage = ingested.transcriptLanguage;
    transcriptSegments = ingested.timestampedTranscript;
    if (ingested.transcriptProvider.startsWith("supadata")) {
      await supabase.from("provider_usage_events").insert({
        user_id: user.id,
        provider: "supadata",
        operation: "transcript",
        result_count: 1,
        metadata: {
          platform: ingested.platform,
          billableRequests: ingested.billableRequests,
          source: "idea_gate_link",
        },
      });
    }
  }
  if (transcript.length >= 20) {
    transcriptsByExternalId.set(video.externalId, transcript);
  }

  const analyzed = await analyzeResearchBatch({
    supabase,
    userId: user.id,
    query: notes || "video link idea",
    videos: [video],
    transcriptsByExternalId,
  });
  const result = analyzed.get(video.externalId);
  const transcriptGrounded =
    result?.analysis.evidenceBasis === "metadata_and_transcript";

  const { data: saved, error: saveError } = await supabase
    .from("research_items")
    .upsert(
      {
        user_id: user.id,
        platform: reference.platform,
        external_id: reference.externalId,
        external_url: reference.normalizedUrl,
        title: notes.slice(0, 120) || result?.analysis.hookText || null,
        description: notes || null,
        hook_text: transcriptGrounded ? result?.analysis.hookText ?? null : null,
        topic: result?.analysis.topic ?? null,
        format: result?.analysis.format ?? null,
        analysis: result?.analysis ?? {},
        analysis_model: result?.model ?? null,
        transcript: transcript || null,
        transcript_provider: transcriptProvider,
        transcript_language: transcriptLanguage,
        transcript_segments: transcriptSegments,
        transcript_retrieved_at: transcript ? new Date().toISOString() : null,
        saved: true,
        source: "manual_reference",
      },
      { onConflict: "user_id,platform,external_id" },
    )
    .select("id")
    .single();

  if (saveError || !saved) {
    return { error: saveError?.message ?? "Could not save the video link." };
  }

  try {
    const { ideas, usedLlm } = await generateIdeasFromOutlier({
      supabase,
      userId: user.id,
      researchItemId: saved.id,
    });
    const idea = ideas[0];
    if (!idea) return { error: "No idea generated from that link." };
    if (!usedLlm) {
      return {
        error:
          "AI did not generate an idea from this link. Check Models / OpenRouter, then retry.",
      };
    }

    const context = await buildFormCraftContext(supabase, {
      userId: user.id,
      taskType: "idea_evaluation",
      query: `${idea.title} ${idea.hook} ${notes}`,
    });
    const ideaText = [
      idea.title,
      "",
      `Hook: ${idea.hook}`,
      "",
      idea.coreClaim,
      notes ? `\nYour notes: ${notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const decision = await evaluateIdeaWithContext({
      idea: ideaText,
      context,
      priorTexts: [],
      supabase,
      userId: user.id,
    });

    const { data, error } = await supabase
      .from("idea_gate_evaluations")
      .insert({
        user_id: user.id,
        idea_text: ideaText,
        recommendation: toDbRecommendation(decision.recommendation),
        why: `${decision.summary}\n\nFrom video link → Idea Gate: ${decision.recommendation}`,
        evidence: decision.evidence.map((label) => ({ label })),
        risks: decision.weaknesses.map((label) => ({ label })),
        missing_ingredient: decision.requiredPersonalContext[0] ?? null,
        better_angle: decision.suggestedAngle ?? idea.uniqueAngle,
        best_format: decision.suggestedFormat ?? idea.format,
        status: "evaluated",
        related_ids: {
          researchItemId: saved.id,
          videoUrl: reference.normalizedUrl,
          idea,
          decision,
        },
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    revalidatePath("/idea-gate");
    revalidatePath("/research");
    return {
      success: true,
      evaluationId: data.id,
      successMessage: `Idea from link gated as ${decision.recommendation}.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not turn that video link into an idea.",
    };
  }
}

export async function deleteIdeaGateEvaluationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("idea_gate_evaluations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/idea-gate");
}
