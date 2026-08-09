import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";

const PROMPT_VERSION = "lesson-interpret-v1";

const lessonInterpretationSchema = z.object({
  lesson: z.string(),
  summary: z.string(),
  confidenceLabel: z.enum(["low", "medium", "high"]),
  contradictoryNote: z.string().nullable(),
});

/**
 * STANDARD AI polish for deterministically computed lesson evidence.
 * Never invents sample sizes — only interprets provided evidence.
 */
export async function interpretLessonEvidence(params: {
  supabase: SupabaseClient;
  userId: string;
  draftLesson: string;
  lessonType: string;
  evidence: Record<string, unknown>;
  sampleSize: number;
}): Promise<{
  lesson: string;
  summary: string;
  confidenceLabel: "low" | "medium" | "high";
  contradictoryNote: string | null;
  usedLlm: boolean;
}> {
  const fallback = {
    lesson: params.draftLesson,
    summary: "Deterministic evidence summary (AI interpretation unavailable).",
    confidenceLabel:
      params.sampleSize >= 12
        ? ("high" as const)
        : params.sampleSize >= 5
          ? ("medium" as const)
          : ("low" as const),
    contradictoryNote: null,
    usedLlm: false,
  };

  const cacheKey = hashAiInput([
    PROMPT_VERSION,
    params.draftLesson,
    params.lessonType,
    params.evidence,
    params.sampleSize,
  ]);

  const result = await tryStructuredAI({
    supabase: params.supabase,
    fallback,
    input: {
      userId: params.userId,
      taskType: "lesson_generation",
      role: "standard",
      promptVersion: PROMPT_VERSION,
      cacheKey,
      maxOutputTokens: 500,
      schema: lessonInterpretationSchema,
      messages: [
        {
          role: "system",
          content:
            "Interpret FormCraft performance evidence. Use only the numbers provided. Never mark Supported. Keep the lesson tentative (Suggested). Return JSON: lesson, summary, confidenceLabel (low|medium|high), contradictoryNote (string|null). Mention if evidence is thin.",
        },
        {
          role: "user",
          content: JSON.stringify({
            draftLesson: params.draftLesson,
            lessonType: params.lessonType,
            sampleSize: params.sampleSize,
            evidence: params.evidence,
          }),
        },
      ],
    },
  });

  return { ...result.data, usedLlm: result.usedLlm };
}
