import type { ResearchPlatform } from "./types";

export type NormalizedSearchFilters = {
  query: string;
  platforms: ResearchPlatform[];
  lookbackDays: number;
  minViews: number;
  minOutlierScore: number;
  maxResults: number;
  language: string | null;
};

const ALLOWED: ResearchPlatform[] = ["youtube", "instagram", "tiktok", "other"];

export function normalizeSearchFilters(input: {
  query?: unknown;
  platforms?: unknown;
  lookbackDays?: unknown;
  minViews?: unknown;
  minOutlierScore?: unknown;
  maxResults?: unknown;
  language?: unknown;
  allowedPlatforms?: ResearchPlatform[];
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
  if (platforms.length === 0) platforms = [...allowed];

  const lookbackDays = clampInt(input.lookbackDays, 1, 90, 30);
  const minViews = clampInt(input.minViews, 0, 10_000_000, 0);
  const minOutlierScore = clampFloat(input.minOutlierScore, 0, 50, 1.5);
  const maxResults = clampInt(input.maxResults, 1, 50, 25);
  const language =
    typeof input.language === "string" && input.language.trim()
      ? input.language.trim().slice(0, 16)
      : null;

  return {
    query,
    platforms,
    lookbackDays,
    minViews,
    minOutlierScore,
    maxResults,
    language,
  };
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
