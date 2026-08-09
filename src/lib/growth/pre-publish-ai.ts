import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import type { ModelTier } from "@/lib/ai/models/types";
import type { PrePublishHeuristicResult } from "./heuristics";

const PROMPT_VERSION = "pre-publish-v2";

const prePublishAiResultSchema = z.object({
  mode: z.literal("openrouter_ai").optional(),
  summary: z.string().min(1),
  checks: z.array(
    z.object({
      id: z.string().min(1),
      pass: z.boolean(),
      note: z.string().min(1),
    }),
  ),
  confidenceNote: z.string().min(1),
});

export async function reviewScriptWithAi(params: {
  supabase: SupabaseClient;
  userId: string;
  inputText: string;
  heuristic: PrePublishHeuristicResult;
  modelTier: ModelTier;
  modelName: string;
}): Promise<{
  result: PrePublishHeuristicResult;
  modelName: string;
  modelTier: ModelTier;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  usedLlm: boolean;
  cached: boolean;
} | null> {
  const script = params.inputText.slice(0, 48_000);
  const cacheKey = hashAiInput([PROMPT_VERSION, script]);

  const result = await tryStructuredAI({
    supabase: params.supabase,
    fallback: {
      mode: "openrouter_ai" as const,
      summary: params.heuristic.summary,
      checks: params.heuristic.checks,
      confidenceNote: params.heuristic.confidenceNote,
    },
    input: {
      userId: params.userId,
      taskType: "pre_publish_review",
      role: "standard",
      promptVersion: PROMPT_VERSION,
      cacheKey,
      modelName: params.modelName,
      maxOutputTokens: 1_200,
      temperature: 0.2,
      schema: prePublishAiResultSchema,
      messages: [
        {
          role: "system",
          content:
            "Review a creator script before publishing. Use only the script and baseline checks. Return only JSON with summary, checks (id, pass, note), and confidenceNote. Evaluate hook clarity, specificity, pacing, proof, payoff, and CTA. Do not claim visual evidence or guaranteed performance.",
        },
        {
          role: "user",
          content: JSON.stringify({
            script,
            baselineChecks: params.heuristic,
          }),
        },
      ],
    },
  });

  if (!result.usedLlm) return null;

  return {
    result: {
      ...result.data,
      mode: "openrouter_ai",
      confidenceNote: `${result.data.confidenceNote} Transcript-only AI review by ${result.model}.${result.cached ? " Cached." : ""}`,
    },
    modelName: result.model,
    modelTier: params.modelTier,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.actualCostUsd,
    usedLlm: result.usedLlm,
    cached: result.cached,
  };
}
