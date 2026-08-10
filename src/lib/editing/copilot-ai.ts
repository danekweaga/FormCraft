import type { SupabaseClient } from "@supabase/supabase-js";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import {
  editingBlueprintSchema,
  type CreativeDirection,
  type EditingBlueprint,
} from "./schema";
import { buildHeuristicBlueprint } from "./blueprint";

const PROMPT_VERSION = "editing-copilot-v1";

export async function generateEditingBlueprintWithAi(params: {
  supabase: SupabaseClient;
  userId: string;
  script: string;
  direction: CreativeDirection;
  stylePrinciples: string[];
  customBrief?: string | null;
  analysisTimeline?: Array<{
    startSeconds: number;
    endSeconds: number;
    type: string;
    transcript: string;
  }>;
  modelName: string;
  usePremium?: boolean;
}): Promise<{
  blueprint: EditingBlueprint;
  modelName: string;
  usedLlm: boolean;
}> {
  const heuristic = buildHeuristicBlueprint({
    script: params.script,
    direction: params.direction,
    stylePrinciples: params.stylePrinciples,
    analysisTimeline: params.analysisTimeline,
  });

  const script = params.script.slice(0, 40_000);
  const cacheKey = hashAiInput([
    PROMPT_VERSION,
    params.direction,
    script,
    params.stylePrinciples.join("|"),
    params.customBrief ?? "",
  ]);

  const result = await tryStructuredAI({
    supabase: params.supabase,
    fallback: heuristic,
    input: {
      userId: params.userId,
      taskType: "editing_guidance",
      role: params.usePremium ? "premium" : "standard",
      promptVersion: PROMPT_VERSION,
      cacheKey,
      modelName: params.modelName,
      maxOutputTokens: 2_800,
      temperature: 0.3,
      schema: editingBlueprintSchema,
      messages: [
        {
          role: "system",
          content: [
            "You are FormCraft's Creative Editing Copilot — not an objective editing authority.",
            "Distinguish observation vs creative_suggestion on every beat (evidenceKind).",
            "Never hard-code cut every N seconds. Never claim memes/punch-ins are mandatory.",
            "Respect creativeDirection. Offer OPTIONAL edits. Include KEEP guidance.",
            "Do not invent facial expressions or cuts without visual evidence in inputs.",
            "Return JSON version editing-blueprint-v1.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            script,
            creativeDirection: params.direction,
            customBrief: params.customBrief ?? null,
            stylePrinciples: params.stylePrinciples,
            baselineBlueprint: heuristic,
            timeline: params.analysisTimeline ?? null,
          }),
        },
      ],
    },
  });

  return {
    blueprint: {
      ...result.data,
      version: "editing-blueprint-v1",
      creativeDirection: params.direction,
      confidenceNote: `${result.data.confidenceNote} Copilot via ${result.model}. Suggestions are creative options.`,
    },
    modelName: result.model,
    usedLlm: result.usedLlm,
  };
}
