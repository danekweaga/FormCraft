import type { SearchPostResult } from "./discovery/types";

export const DEFAULT_DISCOVERY_LOOKBACK_DAYS = 30;
export const MAX_SHORT_FORM_SECONDS = 180;

export function isRecentShortForm(
  post: Pick<SearchPostResult, "platform" | "publishedAt" | "durationSeconds">,
  options: { lookbackDays?: number; now?: number } = {},
): boolean {
  if (!post.publishedAt) return false;
  const published = new Date(post.publishedAt).getTime();
  if (!Number.isFinite(published)) return false;
  const now = options.now ?? Date.now();
  const lookbackDays = options.lookbackDays ?? DEFAULT_DISCOVERY_LOOKBACK_DAYS;
  if (published < now - lookbackDays * 86_400_000 || published > now + 3_600_000) return false;

  if (typeof post.durationSeconds === "number") {
    return post.durationSeconds > 0 && post.durationSeconds <= MAX_SHORT_FORM_SECONDS;
  }

  // TikTok and Instagram creator feeds are video-first. Keep an item with
  // unknown duration, but never make that assumption for YouTube uploads.
  return post.platform === "tiktok" || post.platform === "instagram";
}

export function filterRecentShortForm(
  posts: SearchPostResult[],
  options: { lookbackDays?: number; now?: number } = {},
): SearchPostResult[] {
  return posts.filter((post) => isRecentShortForm(post, options));
}
