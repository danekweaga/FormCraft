import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import {
  buildFormCraftContext,
  contextToPromptBlock,
} from "@/lib/ai/context/formcraft-context";
import { HOOK_MACHINE_SYSTEM_PROMPT } from "@/lib/hooks/hook-machine";
import { buildHookStoryPromptContext } from "@/lib/hooks/starter-library";

export const researchIdeaSchema = z.object({
  title: z.string(),
  hook: z.string(),
  topic: z.string(),
  audienceProblem: z.string(),
  coreClaim: z.string(),
  uniqueAngle: z.string(),
  personalAngle: z.string().nullable(),
  format: z.string(),
  structure: z.array(z.string()),
  cta: z.string(),
  whyItFitsMe: z.string(),
  externalPatternsUsed: z.array(z.string()),
  whatWasChanged: z.array(z.string()),
  duplicateRisk: z.string(),
  experimentOpportunity: z.string().nullable(),
  estimatedEffort: z.enum(["low", "medium", "high"]),
});

export type ResearchIdea = z.infer<typeof researchIdeaSchema>;

const ideasSchema = z.object({
  ideas: z.array(researchIdeaSchema).min(1).max(4),
});

export async function generateIdeasFromOutlier(params: {
  supabase: SupabaseClient;
  userId: string;
  researchItemId: string;
}): Promise<{ ideas: ResearchIdea[]; usedLlm: boolean }> {
  const { data: item } = await params.supabase
    .from("research_items")
    .select(
      "id, title, description, hook_text, topic, analysis, outlier_score, platform, creator_name, external_url",
    )
    .eq("id", params.researchItemId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (!item) throw new Error("Research item not found.");

  const context = await buildFormCraftContext(params.supabase, {
    userId: params.userId,
    taskType: "idea_generation",
    query: `${item.title ?? ""} ${item.topic ?? ""}`,
  });

  const fallback: ResearchIdea = {
    title: `My take: ${(item.topic || item.title || "this niche signal").slice(0, 80)}`,
    hook: "Most advice on this topic skips the part that actually changes outcomes.",
    topic: item.topic || "niche opportunity",
    audienceProblem: "Generic advice without personal proof",
    coreClaim: "A specific personal proof beats abstract claims in this niche.",
    uniqueAngle: "Ground the claim in one concrete personal story.",
    personalAngle: "Use a real experience from your backlog if available.",
    format: "short-form video",
    structure: ["Contrarian or tension open", "Personal proof", "Payoff", "CTA"],
    cta: "Ask which skill they want next",
    whyItFitsMe: context.usedFrom.slice(0, 3).join("; ") || "Needs Idea Gate review",
    externalPatternsUsed: [
      item.hook_text || "External hook pattern",
      "Creator-relative outlier signal",
    ],
    whatWasChanged: [
      "Different personal proof",
      "Different conclusion / CTA",
      "No paraphrase of source title",
    ],
    duplicateRisk: "Review against published My Content before filming",
    experimentOpportunity: null,
    estimatedEffort: "medium",
  };

  const cacheKey = hashAiInput([
    "research-ideas-hook-story-library-v2",
    item.id,
    item.title,
    item.analysis,
    context.usedFrom,
  ]);

  const result = await tryStructuredAI({
    supabase: params.supabase,
    fallback: { ideas: [fallback] },
    input: {
      userId: params.userId,
      taskType: "idea_generation",
      role: "standard",
      promptVersion: "research-ideas-hook-story-library-v2",
      cacheKey,
      maxOutputTokens: 1800,
      schema: ideasSchema,
      messages: [
        {
          role: "system",
          content: [
            "Generate ORIGINAL content ideas from an external outlier. Never paraphrase the source. Transform via different claim, personal story, audience problem, proof, structure, or conclusion.",
            "The `hook` field is spoken-hook copy. Apply the Hook Machine rules below. Internally iterate until each hook is B+ or above. Never use an em-dash.",
            HOOK_MACHINE_SYSTEM_PROMPT,
            buildHookStoryPromptContext({
              objective: "awareness",
              format: "short-form video",
              query: `${item.topic ?? ""} ${item.title ?? ""}`,
              proofAvailable: Boolean(item.analysis),
            }),
            "Return JSON { ideas: [...] } matching the schema. Separate external patterns from personal fit. Do not claim the outlier caused virality.",
          ].join("\n\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            external: {
              title: item.title,
              creator: item.creator_name,
              platform: item.platform,
              url: item.external_url,
              hook: item.hook_text,
              topic: item.topic,
              outlierScore: item.outlier_score,
              analysis: item.analysis,
            },
            personalContext: contextToPromptBlock(context).slice(0, 6000),
            usedFrom: context.usedFrom,
          }),
        },
      ],
    },
  });

  return { ideas: result.data.ideas, usedLlm: result.usedLlm };
}
