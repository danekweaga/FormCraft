import type { SearchPostResult } from "./discovery/types";

export const DEFAULT_DISCOVERY_LOOKBACK_DAYS = 30;
export const MAX_SHORT_FORM_SECONDS = 180;

function normalizeDurationSeconds(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  // Guard against millisecond payloads (e.g. 15200ms).
  if (value > 1000) return Math.round(value / 1000);
  return Math.round(value);
}

export function isRecentShortForm(
  post: Pick<SearchPostResult, "platform" | "publishedAt" | "durationSeconds">,
  options: { lookbackDays?: number; now?: number } = {},
): boolean {
  const now = options.now ?? Date.now();
  const lookbackDays = options.lookbackDays ?? DEFAULT_DISCOVERY_LOOKBACK_DAYS;

  if (post.publishedAt) {
    const published = new Date(post.publishedAt).getTime();
    if (!Number.isFinite(published)) return false;
    if (
      published < now - lookbackDays * 86_400_000 ||
      published > now + 3_600_000
    ) {
      return false;
    }
  } else if (post.platform !== "tiktok" && post.platform !== "instagram") {
    // YouTube/other: require a publish date so long-tail uploads don't sneak in.
    return false;
  }

  const durationSeconds = normalizeDurationSeconds(post.durationSeconds);
  if (durationSeconds != null) {
    return durationSeconds > 0 && durationSeconds <= MAX_SHORT_FORM_SECONDS;
  }

  // TikTok/Instagram feeds are video-first; keep unknown duration.
  // Never make that assumption for YouTube uploads.
  return post.platform === "tiktok" || post.platform === "instagram";
}

export function filterRecentShortForm(
  posts: SearchPostResult[],
  options: { lookbackDays?: number; now?: number } = {},
): SearchPostResult[] {
  return posts.filter((post) => isRecentShortForm(post, options));
}
