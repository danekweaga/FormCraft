import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import {
  buildFormCraftContext,
  contextToPromptBlock,
} from "@/lib/ai/context/formcraft-context";

const briefSchema = z.object({
  strongestOutliers: z.array(z.string()),
  recurringThemes: z.array(z.string()),
  commonHookPatterns: z.array(z.string()),
  commonFormats: z.array(z.string()),
  audiencePains: z.array(z.string()),
  emergingDiscussions: z.array(z.string()),
  oversaturatedAngles: z.array(z.string()),
  potentialGaps: z.array(z.string()),
  whatFitsYourAccount: z.array(z.string()),
  ideasWorthTesting: z.array(z.string()),
  caution: z.string(),
});

export type NicheBrief = z.infer<typeof briefSchema>;

export async function generateNicheBrief(params: {
  supabase: SupabaseClient;
  userId: string;
  topic: string;
  lookbackDays?: number;
}): Promise<{ brief: NicheBrief; usedLlm: boolean; itemCount: number }> {
  const since = new Date(
    Date.now() - (params.lookbackDays ?? 30) * 86_400_000,
  ).toISOString();

  const { data: items } = await params.supabase
    .from("research_items")
    .select(
      "title, topic, hook_text, outlier_score, outlier_label, platform, creator_name, views, score_basis, baseline_sample_size",
    )
    .eq("user_id", params.userId)
    .eq("hidden", false)
    .gte("discovered_at", since)
    .order("outlier_score", { ascending: false, nullsFirst: false })
    .limit(40);

  const rows = items ?? [];
  const context = await buildFormCraftContext(params.supabase, {
    userId: params.userId,
    taskType: "performance_review",
    query: params.topic,
  });

  const fallback: NicheBrief = {
    strongestOutliers: rows
      .filter((r) => (r.outlier_score ?? 0) >= 2.5)
      .slice(0, 5)
      .map(
        (r) =>
          `${r.title?.slice(0, 80) ?? "Untitled"} (${Number(r.outlier_score).toFixed(1)}×, ${r.platform})`,
      ),
    recurringThemes: Array.from(
      new Set(rows.map((r) => r.topic).filter(Boolean) as string[]),
    ).slice(0, 6),
    commonHookPatterns: rows
      .map((r) => r.hook_text)
      .filter(Boolean)
      .slice(0, 5) as string[],
    commonFormats: ["short-form video"],
    audiencePains: [],
    emergingDiscussions: [],
    oversaturatedAngles: [],
    potentialGaps: [
      "Potential gap: compare audience questions in FormCraft against topics in this dataset.",
    ],
    whatFitsYourAccount: context.usedFrom.slice(0, 4),
    ideasWorthTesting: [],
    caution:
      rows.length < 8
        ? "Not enough stored research items for a broad niche claim. Treat this as a potential brief."
        : "Interpretations are hypotheses from available public metadata, not platform-wide truth.",
  };

  if (rows.length === 0) {
    return { brief: fallback, usedLlm: false, itemCount: 0 };
  }

  const result = await tryStructuredAI({
    supabase: params.supabase,
    fallback,
    input: {
      userId: params.userId,
      taskType: "performance_review",
      role: "standard",
      promptVersion: "niche-brief-v1",
      cacheKey: hashAiInput(["niche-brief-v1", params.topic, rows]),
      maxOutputTokens: 1600,
      schema: briefSchema,
      messages: [
        {
          role: "system",
          content:
            "Write a Niche Intelligence Brief from provided research items + personal context. Label gaps as potential unless dataset is broad. Never invent metrics. Return JSON matching the schema. Separate observation from interpretation.",
        },
        {
          role: "user",
          content: JSON.stringify({
            topic: params.topic,
            lookbackDays: params.lookbackDays ?? 30,
            items: rows.slice(0, 30),
            personalContext: contextToPromptBlock(context).slice(0, 4000),
          }),
        },
      ],
    },
  });

  return {
    brief: result.data,
    usedLlm: result.usedLlm,
    itemCount: rows.length,
  };
}
