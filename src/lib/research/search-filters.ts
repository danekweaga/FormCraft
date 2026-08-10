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

/**
 * Default platforms for discovery: exclude YouTube unless it is the only
 * configured searchable platform (saves YouTube Data API quota by default).
 */
export function defaultDiscoveryPlatforms(
  searchable: ResearchPlatform[],
): ResearchPlatform[] {
  if (searchable.length === 0) return [];
  const nonYoutube = searchable.filter((p) => p !== "youtube");
  if (nonYoutube.length > 0) return nonYoutube;
  return searchable.includes("youtube") ? ["youtube"] : [...searchable];
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
  /** When true and platforms empty after parse, use defaultDiscoveryPlatforms */
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
    platforms =
      input.preferNonYoutubeDefault !== false
        ? defaultDiscoveryPlatforms(allowed)
        : [...allowed];
  }

  const lookbackDays = clampInt(input.lookbackDays, 1, 90, 30);
  const minViews = clampInt(input.minViews, 0, 10_000_000, 0);
  const minOutlierScore = clampFloat(input.minOutlierScore, 0, 50, 1.5);
  const maxResults = clampInt(input.maxResults, 1, 50, 25);
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
