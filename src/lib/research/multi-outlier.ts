import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import {
  buildFormCraftContext,
  contextToPromptBlock,
} from "@/lib/ai/context/formcraft-context";

const synthesisSchema = z.object({
  commonSignal: z.string(),
  sharedPatterns: z.array(z.string()),
  oversaturated: z.array(z.string()),
  potentialGap: z.string(),
  personalFit: z.enum(["strong", "medium", "weak"]),
  personalFitWhy: z.array(z.string()),
  caution: z.string(),
});

export async function synthesizeMultiOutliers(params: {
  supabase: SupabaseClient;
  userId: string;
  itemIds: string[];
}): Promise<string> {
  const { data: items } = await params.supabase
    .from("research_items")
    .select(
      "id, title, topic, hook_text, outlier_score, platform, creator_name, analysis",
    )
    .eq("user_id", params.userId)
    .in("id", params.itemIds.slice(0, 7));

  if (!items?.length) throw new Error("Select research items first.");

  const context = await buildFormCraftContext(params.supabase, {
    userId: params.userId,
    taskType: "idea_generation",
    query: items.map((i) => i.topic || i.title).join(" "),
  });

  const fallback = {
    commonSignal: items
      .map((i) => i.topic)
      .filter(Boolean)
      .slice(0, 3)
      .join("; ") || "Shared niche theme across selected posts.",
    sharedPatterns: items
      .map((i) => i.hook_text)
      .filter(Boolean)
      .slice(0, 4) as string[],
    oversaturated: [] as string[],
    potentialGap:
      "Potential gap: compare these themes with unanswered audience questions in FormCraft.",
    personalFit: "medium" as const,
    personalFitWhy: context.usedFrom.slice(0, 3),
    caution: "Based only on the selected public metadata sample.",
  };

  const result = await tryStructuredAI({
    supabase: params.supabase,
    fallback,
    input: {
      userId: params.userId,
      taskType: "idea_generation",
      role: "standard",
      promptVersion: "multi-outlier-v1",
      cacheKey: hashAiInput(["multi-outlier-v1", params.itemIds, items]),
      maxOutputTokens: 1200,
      schema: synthesisSchema,
      messages: [
        {
          role: "system",
          content:
            "Synthesize common opportunity across external outliers. Label gaps as potential. Never invent metrics. Return JSON matching schema.",
        },
        {
          role: "user",
          content: JSON.stringify({
            items,
            personalContext: contextToPromptBlock(context).slice(0, 4000),
          }),
        },
      ],
    },
  });

  const d = result.data;
  return [
    "COMMON SIGNAL",
    d.commonSignal,
    "",
    "SHARED PATTERNS",
    ...d.sharedPatterns.map((p) => `• ${p}`),
    "",
    "OVERSATURATED",
    ...(d.oversaturated.length
      ? d.oversaturated.map((p) => `• ${p}`)
      : ["• None clearly identified in this small sample"]),
    "",
    "POTENTIAL GAP",
    d.potentialGap,
    "",
    `PERSONAL FIT: ${d.personalFit}`,
    ...d.personalFitWhy.map((p) => `• ${p}`),
    "",
    d.caution,
  ].join("\n");
}
