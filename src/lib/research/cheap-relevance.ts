import type { ScoredResearchVideo } from "./types";

export type CheapRelevanceResult = {
  relevant: boolean;
  relevanceReason: string;
  topic: string;
  format: string | null;
  audience: string | null;
};

/**
 * Deterministic cheap relevance filter (no LLM).
 * Cache key = platform + externalId + query.
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
  return `${platform}:${externalId}:${query.trim().toLowerCase()}`;
}
