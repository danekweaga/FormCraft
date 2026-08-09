import type { SupabaseClient } from "@supabase/supabase-js";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import type { ModelTier } from "@/lib/ai/models/types";
import { analysisResultSchema, type AnalysisResult } from "./schema";

const PROMPT_VERSION = "openrouter-transcript-v2";

export async function analyzeTranscriptWithAi(params: {
  supabase: SupabaseClient;
  userId: string;
  transcript: string;
  mode: "quick" | "deep" | "expert";
  subjectType: string;
  heuristic: AnalysisResult;
  modelTier: ModelTier;
  modelName: string;
  /** Personal FormCraft context for owned posts only */
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
        params.mode === "quick" ? 1_600 : params.mode === "deep" ? 3_200 : 4_800,
      temperature: 0.2,
      schema: analysisResultSchema,
      messages: [
        {
          role: "system",
          content: [
            "You are FormCraft's transcript analyst.",
            "Use only evidence in the supplied transcript, baseline heuristic, and personal context (if any).",
            "Do not claim to see visuals, hear audio, know retention curves, or prove causation.",
            "If personal context is provided, ground comparisons in that data only — never invent private analytics.",
            "If content is external, do not imply the creator's private metrics are available.",
            "Return ONLY valid JSON with exactly these top-level keys:",
            "overview, timeline, hooks, openLoops, psychology, retentionDevices, potentialRetentionRisks, claims, strengths, improvements, improvedHooks, recommendedStructure, scorecard, confidenceNotes.",
            "Timeline entries: startLabel, optional endLabel, segment, purpose, optional notes.",
            "Hook effectiveness: strong|moderate|weak. Retention risk severity: low|medium|high.",
            "Improvement priority: low|medium|high. Scorecard scores must be 0-10.",
            "Every claim must say whether transcript evidence supports it. Keep arrays concise.",
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
    // Distinguish budget/config failure from "use heuristic silently"
    return null;
  }

  return {
    result: {
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
