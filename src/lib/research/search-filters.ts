import type { ResearchPlatform } from "./types";

export type NormalizedSearchFilters = {
  query: string;
  platforms: ResearchPlatform[];
  lookbackDays: number;
  minViews: number;
  minOutlierScore: number;
  maxResults: number;
  language: string | null;
  creatorIds: string[];
  channelHandles: string[];
};

const ALLOWED: ResearchPlatform[] = ["youtube", "instagram", "tiktok", "other"];

const QUERY_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "your",
  "this",
  "that",
  "into",
  "about",
]);

/** TikTok search ranks better on 1–3 keywords than a long niche sentence. */
export function compactDiscoveryQuery(query: string, maxTerms = 3): string {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length >= 2 && !QUERY_STOPWORDS.has(t));
  return (terms.slice(0, maxTerms).join(" ") || query.trim()).slice(0, 80);
}

/**
 * Default platforms for discovery: all configured searchable sources.
 * YouTube is included when YOUTUBE_DATA_API_KEY is present (users can uncheck).
 */
export function defaultDiscoveryPlatforms(
  searchable: ResearchPlatform[],
): ResearchPlatform[] {
  return [...searchable];
}

export function normalizeSearchFilters(input: {
  query?: unknown;
  platforms?: unknown;
  lookbackDays?: unknown;
  minViews?: unknown;
  minOutlierScore?: unknown;
  maxResults?: unknown;
  language?: unknown;
  allowedPlatforms?: ResearchPlatform[];
  creatorIds?: unknown;
  channelHandles?: unknown;
  /**
   * Legacy: when true and platforms empty, drop YouTube if another source exists.
   * Default is false — include all configured platforms (incl. YouTube).
   */
  preferNonYoutubeDefault?: boolean;
}): NormalizedSearchFilters {
  const query = String(input.query ?? "").trim().slice(0, 200);
  const allowed = input.allowedPlatforms?.length
    ? input.allowedPlatforms
    : (["youtube"] as ResearchPlatform[]);

  let platforms: ResearchPlatform[] = [];
  if (Array.isArray(input.platforms)) {
    platforms = input.platforms
      .map((p) => String(p).toLowerCase() as ResearchPlatform)
      .filter((p) => ALLOWED.includes(p) && allowed.includes(p));
  } else if (typeof input.platforms === "string") {
    platforms = input.platforms
      .split(",")
      .map((p) => p.trim().toLowerCase() as ResearchPlatform)
      .filter((p) => ALLOWED.includes(p) && allowed.includes(p));
  }

  if (platforms.length === 0) {
    if (input.preferNonYoutubeDefault === true) {
      const nonYoutube = allowed.filter((p) => p !== "youtube");
      platforms =
        nonYoutube.length > 0
          ? nonYoutube
          : allowed.includes("youtube")
            ? (["youtube"] as ResearchPlatform[])
            : [...allowed];
    } else {
      platforms = defaultDiscoveryPlatforms(allowed);
    }
  }

  const lookbackDays = clampInt(input.lookbackDays, 1, 90, 30);
  const minViews = clampInt(input.minViews, 0, 10_000_000, 0);
  const minOutlierScore = clampFloat(input.minOutlierScore, 0, 50, 0);
  const maxResults = clampInt(input.maxResults, 1, 50, 50);
  const language =
    typeof input.language === "string" && input.language.trim()
      ? input.language.trim().slice(0, 16)
      : null;

  const creatorIds = parseIdList(input.creatorIds);
  const channelHandles = parseHandleList(input.channelHandles);

  return {
    query,
    platforms,
    lookbackDays,
    minViews,
    minOutlierScore,
    maxResults,
    language,
    creatorIds,
    channelHandles,
  };
}

function parseIdList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,]+/)
      : [];
  return Array.from(
    new Set(
      raw
        .map((v) => String(v).trim())
        .filter((v) => /^[0-9a-f-]{36}$/i.test(v) || v.length > 0),
    ),
  )
    .filter((v) => /^[0-9a-f-]{36}$/i.test(v))
    .slice(0, 25);
}

function parseHandleList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : [];
  return Array.from(
    new Set(
      raw
        .map((v) => String(v).trim().replace(/^@/, ""))
        .filter((v) => v.length >= 2 && v.length <= 80),
    ),
  ).slice(0, 25);
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampFloat(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
