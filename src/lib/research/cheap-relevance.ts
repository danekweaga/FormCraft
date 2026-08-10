import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import type { ScoredResearchVideo } from "./types";

export type CheapRelevanceResult = {
  relevant: boolean;
  relevanceReason: string;
  topic: string;
  format: string | null;
  audience: string | null;
};

const cheapRelevanceSchema = z.object({
  relevant: z.boolean(),
  relevanceReason: z.string(),
  topic: z.string(),
  format: z.string().nullable(),
  audience: z.string().nullable(),
});

/**
 * Deterministic cheap relevance filter (no LLM).
 */
export function classifyCheapRelevance(
  item: ScoredResearchVideo & { topic?: string | null },
  query: string,
): CheapRelevanceResult {
  const hay = `${item.title ?? ""} ${item.description ?? ""}`.toLowerCase();
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  const hits = terms.filter((t) => hay.includes(t)).length;
  const relevant = hits >= Math.min(2, Math.max(1, terms.length));
  const seconds = item.durationSeconds;
  const format =
    seconds == null
      ? null
      : seconds <= 90
        ? "short"
        : seconds <= 600
          ? "mid_form"
          : "long_form";

  return {
    relevant,
    relevanceReason: relevant
      ? `Title/description matches ${hits} query term(s)`
      : "Weak lexical overlap with search query",
    topic: item.topic ?? query,
    format,
    audience: null,
  };
}

export function cheapRelevanceCacheKey(
  platform: string,
  externalId: string,
  query: string,
): string {
  return `cheap-relevance:${platform}:${externalId}:${query.trim().toLowerCase()}`;
}

/**
 * Lexical first, then cheap LLM for nuanced classification when available.
 * Caps LLM calls per batch to control cost.
 */
export async function classifyCheapRelevanceBatch(params: {
  supabase: SupabaseClient;
  userId: string;
  query: string;
  items: Array<ScoredResearchVideo & { topic?: string | null }>;
  maxLlmCalls?: number;
}): Promise<Map<string, CheapRelevanceResult>> {
  const out = new Map<string, CheapRelevanceResult>();
  const maxLlm = params.maxLlmCalls ?? 8;
  let llmCalls = 0;

  for (const item of params.items) {
    const key = `${item.platform}:${item.externalId}`;
    const lexical = classifyCheapRelevance(item, params.query);

    if (llmCalls >= maxLlm) {
      out.set(key, lexical);
      continue;
    }

    const cacheKey = cheapRelevanceCacheKey(
      item.platform,
      item.externalId,
      params.query,
    );
    const result = await tryStructuredAI({
      supabase: params.supabase,
      fallback: lexical,
      input: {
        userId: params.userId,
        taskType: "content_classification",
        role: "cheap",
        promptVersion: "cheap-relevance-v1",
        cacheKey: hashAiInput([
          cacheKey,
          item.title,
          item.description?.slice(0, 400),
        ]),
        schema: cheapRelevanceSchema,
        maxOutputTokens: 250,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "Classify whether an external post is relevant to the user's niche query. Be strict. Separate observed title/description from interpretation. Return JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              query: params.query,
              title: item.title,
              description: item.description?.slice(0, 500) ?? null,
              platform: item.platform,
              outlierScore: item.outlierScore,
              lexicalHint: lexical,
            }),
          },
        ],
      },
    });

    if (result.usedLlm) llmCalls += 1;
    out.set(key, {
      relevant: result.data.relevant,
      relevanceReason: result.data.relevanceReason.slice(0, 300),
      topic: result.data.topic || lexical.topic,
      format: result.data.format ?? lexical.format,
      audience: result.data.audience,
    });
  }

  return out;
}
