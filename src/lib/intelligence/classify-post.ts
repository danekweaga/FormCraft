import type { SupabaseClient } from "@supabase/supabase-js";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import { callOpenRouter } from "@/lib/ai/models/openrouter";
import { resolveModelTier } from "@/lib/ai/models/router";
import type { LlmResult, ModelTier } from "@/lib/ai/models/types";
import { z } from "zod";

export const postClassificationSchema = z.object({
  topic: z.string().nullable(),
  content_pillar: z.string().nullable(),
  format: z.string().nullable(),
  hook_type: z.string().nullable(),
  cta_type: z.string().nullable(),
  story_presence: z.boolean(),
  personal_story_presence: z.boolean(),
  opinion_strength: z.enum(["low", "medium", "high"]),
  content_mode: z.enum([
    "educational",
    "opinion",
    "story",
    "entertainment",
    "mixed",
    "unknown",
  ]),
  structure: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type PostClassification = z.infer<typeof postClassificationSchema>;

export function classifyPostHeuristic(input: {
  caption: string | null;
  title: string | null;
  format: string | null;
  durationSeconds: number | null;
}): PostClassification {
  const text = `${input.title ?? ""}\n${input.caption ?? ""}`.toLowerCase();
  const personal =
    /\b(i |my |me |i'm|i’ve|i've|when i|last week|internship|my team)\b/.test(
      text,
    );
  const opinion =
    /\b(stop|never|always|wrong|truth|most people|nobody|hate|love)\b/.test(
      text,
    );
  const educational =
    /\b(how to|guide|tips|learn|framework|step|why you should)\b/.test(text);
  const questionHook = /^\s*(why|what|how|do you|are you|is your)/i.test(
    input.caption ?? input.title ?? "",
  );
  const contrarian = /\b(stop|don't|never|wrong|myth|lie)\b/i.test(text);

  let content_mode: PostClassification["content_mode"] = "unknown";
  if (personal && !educational) content_mode = "story";
  else if (educational && opinion) content_mode = "mixed";
  else if (educational) content_mode = "educational";
  else if (opinion) content_mode = "opinion";

  return {
    topic: null,
    content_pillar: personal
      ? "personal_story"
      : educational
        ? "education"
        : null,
    format:
      input.format ??
      (input.durationSeconds && input.durationSeconds <= 90 ? "short" : null),
    hook_type: contrarian
      ? "contrarian"
      : questionHook
        ? "question"
        : personal
          ? "personal"
          : "other",
    cta_type: /\b(comment|follow|save|share|link in bio)\b/i.test(text)
      ? "engagement"
      : null,
    story_presence: personal || /\bstory\b/.test(text),
    personal_story_presence: personal,
    opinion_strength: opinion ? "high" : personal ? "medium" : "low",
    content_mode,
    structure: personal
      ? "personal_example_first"
      : educational
        ? "claim_then_steps"
        : null,
    confidence: 0.45,
  };
}

const PROMPT_VERSION = "classify-post-v2";

export async function classifyPost(input: {
  caption: string | null;
  title: string | null;
  format: string | null;
  durationSeconds: number | null;
  modelName?: string;
  modelTier?: ModelTier;
  /** When provided, uses FormCraft AI client (budget, cache, jobs). */
  supabase?: SupabaseClient;
  userId?: string;
}): Promise<{
  classification: PostClassification;
  model: string;
  llm?: LlmResult;
  cached?: boolean;
}> {
  const heuristic = classifyPostHeuristic(input);
  const cacheKey = hashAiInput([
    PROMPT_VERSION,
    input.title,
    input.caption,
    input.format,
    input.durationSeconds,
  ]);

  if (input.supabase && input.userId) {
    const result = await tryStructuredAI({
      supabase: input.supabase,
      fallback: heuristic,
      input: {
        userId: input.userId,
        taskType: "content_classification",
        role: "cheap",
        promptVersion: PROMPT_VERSION,
        cacheKey,
        modelName: input.modelName,
        maxOutputTokens: 400,
        schema: postClassificationSchema,
        messages: [
          {
            role: "system",
            content:
              "Classify creator short-form content. Return ONLY JSON matching keys: topic, content_pillar, format, hook_type, cta_type, story_presence, personal_story_presence, opinion_strength (low|medium|high), content_mode (educational|opinion|story|entertainment|mixed|unknown), structure, confidence (0-1). No visuals unless described.",
          },
          {
            role: "user",
            content: JSON.stringify({
              title: input.title,
              caption: input.caption,
              format: input.format,
              durationSeconds: input.durationSeconds,
            }),
          },
        ],
      },
    });
    return {
      classification: result.data,
      model: result.usedLlm ? result.model : "heuristic-v1",
      cached: result.cached,
    };
  }

  // Legacy path without supabase (tests / callers)
  const tier = input.modelTier ?? resolveModelTier("content_classification");
  try {
    const llm = await callOpenRouter({
      tier,
      modelName: input.modelName,
      maxOutputTokens: 400,
      messages: [
        {
          role: "system",
          content:
            "Classify creator short-form content. Return ONLY JSON matching keys: topic, content_pillar, format, hook_type, cta_type, story_presence, personal_story_presence, opinion_strength (low|medium|high), content_mode (educational|opinion|story|entertainment|mixed|unknown), structure, confidence (0-1). No visuals unless described.",
        },
        {
          role: "user",
          content: JSON.stringify({
            title: input.title,
            caption: input.caption,
            format: input.format,
            durationSeconds: input.durationSeconds,
          }),
        },
      ],
    });
    if (!llm?.text) {
      return { classification: heuristic, model: "heuristic-v1" };
    }
    const jsonStart = llm.text.indexOf("{");
    const jsonEnd = llm.text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      return { classification: heuristic, model: "heuristic-v1" };
    }
    const parsed = postClassificationSchema.safeParse(
      JSON.parse(llm.text.slice(jsonStart, jsonEnd + 1)),
    );
    if (!parsed.success) {
      return { classification: heuristic, model: "heuristic-v1" };
    }
    return { classification: parsed.data, model: llm.modelName, llm };
  } catch {
    return { classification: heuristic, model: "heuristic-v1" };
  }
}
