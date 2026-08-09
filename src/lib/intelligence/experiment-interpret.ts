import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import type { ExperimentAggregate } from "./experiment-stats";

const PROMPT_VERSION = "experiment-interpret-v1";

const interpretationSchema = z.object({
  observation: z.string(),
  recommendation: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  contradictoryEvidence: z.array(z.string()),
});

export type ExperimentInterpretation = z.infer<typeof interpretationSchema> & {
  usedLlm: boolean;
};

export async function interpretExperimentAggregate(params: {
  supabase: SupabaseClient;
  userId: string;
  hypothesis: string;
  aggregate: ExperimentAggregate;
}): Promise<ExperimentInterpretation> {
  const fallback: ExperimentInterpretation = {
    observation: params.aggregate.evidenceLimited
      ? "Evidence remains limited."
      : "Sample size is usable for a cautious comparison.",
    recommendation: params.aggregate.recommendation,
    confidence: params.aggregate.evidenceLimited ? "low" : "medium",
    contradictoryEvidence: [],
    usedLlm: false,
  };

  const cacheKey = hashAiInput([
    PROMPT_VERSION,
    params.hypothesis,
    params.aggregate,
  ]);

  const result = await tryStructuredAI({
    supabase: params.supabase,
    fallback,
    input: {
      userId: params.userId,
      taskType: "experiment_analysis",
      role: "standard",
      promptVersion: PROMPT_VERSION,
      cacheKey,
      maxOutputTokens: 600,
      schema: interpretationSchema,
      messages: [
        {
          role: "system",
          content:
            "Interpret FormCraft experiment aggregates. Use only provided numbers. Do not declare a winner with thin samples. Return JSON: observation, recommendation, confidence (low|medium|high), contradictoryEvidence (array). Prefer recommending more posts when evidenceLimited is true.",
        },
        {
          role: "user",
          content: JSON.stringify({
            hypothesis: params.hypothesis,
            aggregate: params.aggregate,
          }),
        },
      ],
    },
  });

  return { ...result.data, usedLlm: result.usedLlm };
}
