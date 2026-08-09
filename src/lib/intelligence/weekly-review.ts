import type { SupabaseClient } from "@supabase/supabase-js";
import { tryStructuredAI } from "@/lib/ai/client";
import {
  buildFormCraftContext,
  contextToPromptBlock,
} from "@/lib/ai/context/formcraft-context";
import { z } from "zod";
import { detectRoadmapBottleneck } from "./roadmap-bottleneck";

export const weeklyReviewSchema = z.object({
  performanceSummary: z.string(),
  biggestWinner: z.string(),
  biggestMiss: z.string(),
  audienceSignals: z.array(z.string()),
  experimentProgress: z.string(),
  whatChanged: z.string(),
  whatSeemsWorking: z.array(z.string()),
  whatSeemsWeaker: z.array(z.string()),
  makeMoreOf: z.array(z.string()),
  reduce: z.array(z.string()),
  nextWeekExperiments: z.array(z.string()),
  roadmapImpact: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  sourcesUsed: z.array(z.string()),
});

export type WeeklyReview = z.infer<typeof weeklyReviewSchema>;

export async function generateWeeklyReview(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<{ review: WeeklyReview; usedLlm: boolean }> {
  const context = await buildFormCraftContext(params.supabase, {
    userId: params.userId,
    taskType: "weekly_review",
    query: "weekly performance audience experiments roadmap",
  });
  const bottleneck = await detectRoadmapBottleneck(params);

  const { data: posts } = await params.supabase
    .from("content_posts")
    .select("id, title, caption, views, is_winner, needs_review, published_at")
    .eq("user_id", params.userId)
    .gte(
      "published_at",
      new Date(Date.now() - 7 * 86_400_000).toISOString(),
    )
    .order("published_at", { ascending: false });

  const winners = (posts ?? []).filter((p) => p.is_winner);
  const misses = (posts ?? []).filter((p) => p.needs_review);
  const topWinner = winners.sort(
    (a, b) => (b.views ?? 0) - (a.views ?? 0),
  )[0];
  const topMiss = misses[0];

  const fallback: WeeklyReview = {
    performanceSummary: `Published ${(posts ?? []).length} posts in the last 7 days. Bottleneck: ${bottleneck.bottleneck}.`,
    biggestWinner: topWinner
      ? topWinner.title || topWinner.caption?.slice(0, 80) || "Winner post"
      : "Not enough evidence yet.",
    biggestMiss: topMiss
      ? topMiss.title || topMiss.caption?.slice(0, 80) || "Underperformer"
      : "Not enough evidence yet.",
    audienceSignals: context.usedFrom.filter((s) =>
      s.toLowerCase().includes("audience"),
    ),
    experimentProgress: "Check Experiments for attached-post metric updates.",
    whatChanged: "Based on synced Instagram metrics and FormCraft state.",
    whatSeemsWorking: winners.length
      ? ["Posts flagged as winners vs your baseline"]
      : ["Not enough evidence yet."],
    whatSeemsWeaker: misses.length
      ? ["Posts flagged Needs Review"]
      : ["Not enough evidence yet."],
    makeMoreOf: bottleneck.bottleneck === "Execution" ? [] : ["Formats that beat baseline"],
    reduce:
      bottleneck.bottleneck === "Execution"
        ? ["New idea generation until backlog clears"]
        : [],
    nextWeekExperiments: [
      "Continue any under-sampled running experiment before concluding.",
    ],
    roadmapImpact: bottleneck.recommendation,
    confidence: (posts ?? []).length >= 5 ? "medium" : "low",
    sourcesUsed: context.usedFrom,
  };

  const result = await tryStructuredAI({
    supabase: params.supabase,
    fallback,
    input: {
      userId: params.userId,
      taskType: "weekly_review",
      role: "standard",
      promptVersion: "weekly-review-v1",
      schema: weeklyReviewSchema,
      maxOutputTokens: 1400,
      messages: [
        {
          role: "system",
          content:
            "You are FormCraft weekly reviewer. Use only provided context. Return JSON matching the weekly review schema. Never invent metrics. If evidence is thin, say Not enough evidence yet.",
        },
        {
          role: "user",
          content: JSON.stringify({
            bottleneck,
            postsThisWeek: (posts ?? []).length,
            context: contextToPromptBlock(context).slice(0, 12000),
            usedFrom: context.usedFrom,
          }),
        },
      ],
    },
  });

  // Persist into weekly reports table
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  await params.supabase.from("content_weekly_reports").upsert(
    {
      user_id: params.userId,
      week_start: weekStart.toISOString().slice(0, 10),
      week_end: weekEnd.toISOString().slice(0, 10),
      report: {
        ...result.data,
        usedLlm: result.usedLlm,
        model: result.model,
        generatedAt: new Date().toISOString(),
      },
    },
    { onConflict: "user_id,week_start" },
  );

  return { review: result.data, usedLlm: result.usedLlm };
}
