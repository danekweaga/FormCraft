import type { SupabaseClient } from "@supabase/supabase-js";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import type { ModelTier } from "@/lib/ai/models/types";
import {
  analysisResultSchema,
  normalizeAnalysisResult,
  type AnalysisResult,
} from "./schema";

const PROMPT_VERSION = "openrouter-transcript-v3";

/** Legacy single-shot AI path — prefer runStagedAnalysis for Growth I. */
export async function analyzeTranscriptWithAi(params: {
  supabase: SupabaseClient;
  userId: string;
  transcript: string;
  mode: "quick" | "deep" | "expert";
  subjectType: string;
  heuristic: AnalysisResult;
  modelTier: ModelTier;
  modelName: string;
  personalContext?: string | null;
}): Promise<{
  result: AnalysisResult;
  modelName: string;
  modelTier: ModelTier;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  usedLlm: boolean;
  cached: boolean;
} | null> {
  const characterLimit =
    params.mode === "quick" ? 18_000 : params.mode === "deep" ? 48_000 : 90_000;
  const transcript = params.transcript.slice(0, characterLimit);
  const truncated = transcript.length < params.transcript.length;
  const personal =
    params.subjectType === "own_content"
      ? (params.personalContext ?? "").slice(0, 6_000)
      : "";

  const cacheKey = hashAiInput([
    PROMPT_VERSION,
    params.mode,
    params.subjectType,
    transcript,
    personal,
  ]);

  const result = await tryStructuredAI({
    supabase: params.supabase,
    fallback: params.heuristic,
    input: {
      userId: params.userId,
      taskType: "content_analysis",
      role: params.modelTier === "premium" ? "premium" : "standard",
      promptVersion: PROMPT_VERSION,
      cacheKey,
      modelName: params.modelName,
      maxOutputTokens:
        params.mode === "quick" ? 2_000 : params.mode === "deep" ? 3_600 : 5_000,
      temperature: 0.2,
      schema: analysisResultSchema,
      messages: [
        {
          role: "system",
          content: [
            "You are FormCraft's transcript analyst.",
            "Use only evidence in the supplied transcript, baseline heuristic, and personal context (if any).",
            "Do not claim to see visuals, hear audio, know retention curves, or prove causation.",
            "Scorecard ratings must be Excellent|Strong|Good|Needs Work|Weak|Unable to Evaluate.",
            "Improvements use priority high|medium|optional with issue, whyItMatters, recommendation, example.",
            "Return ONLY valid JSON matching the schema.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            mode: params.mode,
            subjectType: params.subjectType,
            transcript,
            transcriptTruncated: truncated,
            baselineHeuristic: params.heuristic,
            personalContext: personal || null,
          }),
        },
      ],
    },
  });

  if (!result.usedLlm && result.validationState === "fallback") {
    return {
      result: normalizeAnalysisResult({
        ...params.heuristic,
        confidenceNotes: [
          ...params.heuristic.confidenceNotes,
          result.fallbackReason
            ? `Heuristic analysis — ${result.fallbackReason}`
            : "Heuristic transcript analysis — OpenRouter unavailable.",
        ],
      }),
      modelName: "heuristic-v1",
      modelTier: params.modelTier,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      usedLlm: false,
      cached: false,
    };
  }

  const normalized = normalizeAnalysisResult({
    ...result.data,
    confidenceNotes: [
      ...result.data.confidenceNotes,
      `AI transcript analysis by ${result.model}; no visual or audio evidence was supplied.`,
      ...(truncated
        ? ["The transcript was truncated to the selected mode's context limit."]
        : []),
      ...(personal
        ? ["Personal FormCraft context (My Content / lessons / experiments) was included."]
        : []),
      ...(result.cached ? ["Result served from AI cache (same inputs)."] : []),
    ],
  });

  return {
    result: normalized,
    modelName: result.model,
    modelTier: params.modelTier,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.actualCostUsd,
    usedLlm: result.usedLlm,
    cached: result.cached,
  };
}
