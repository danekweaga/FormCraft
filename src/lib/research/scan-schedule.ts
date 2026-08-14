export const DAILY_RESEARCH_SCAN_UTC_HOUR = 12;
/** Skip a visit-time refresh if a scan already ran this recently. */
export const VISIT_REFRESH_COOLDOWN_MS = 15 * 60 * 1000;
/** Overlap the last scan so we don't miss videos published during the run. */
export const INCREMENTAL_LOOKBACK_OVERLAP_MS = 2 * 60 * 60 * 1000;

/**
 * Return the next fixed daily research window.
 *
 * Using a fixed UTC time avoids the drift caused by `last run + 24 hours`:
 * a manual run after the cron window would otherwise miss the next day and
 * wait almost 48 hours for fresh recommendations.
 */
export function nextDailyResearchRunAt(
  now = new Date(),
  utcHour = DAILY_RESEARCH_SCAN_UTC_HOUR,
): Date {
  const next = new Date(now);
  next.setUTCHours(utcHour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function asTime(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Visit-time For You refresh. A full keyword rescrape on every open would
 * burn credits on videos already in the database.
 */
export function shouldRefreshOnVisit(
  lastRunAt: string | Date | null | undefined,
  now = new Date(),
  cooldownMs = VISIT_REFRESH_COOLDOWN_MS,
): boolean {
  const last = asTime(lastRunAt);
  if (last == null) return true;
  return now.getTime() - last >= cooldownMs;
}

/**
 * How far back a follow-up niche search should look. First run uses the
 * scan's full window; later runs only cover time since the last pull.
 */
export function incrementalLookbackDays(
  lastRunAt: string | Date | null | undefined,
  maxDays = 30,
  now = new Date(),
): number {
  const cap = Math.max(1, maxDays);
  const last = asTime(lastRunAt);
  if (last == null) return cap;
  const elapsedDays = (now.getTime() - last) / 86_400_000;
  return Math.min(cap, Math.max(1, Math.ceil(elapsedDays)));
}

export function postedSinceCutoff(
  lastRunAt: string | Date | null | undefined,
  overlapMs = INCREMENTAL_LOOKBACK_OVERLAP_MS,
): Date | null {
  const last = asTime(lastRunAt);
  if (last == null) return null;
  return new Date(last - overlapMs);
}

export function keepPostsPostedSince<T extends { publishedAt?: string | null }>(
  posts: T[],
  cutoff: Date | null,
): T[] {
  if (!cutoff) return posts;
  const ms = cutoff.getTime();
  return posts.filter((post) => {
    if (!post.publishedAt) return true;
    const published = new Date(post.publishedAt).getTime();
    return !Number.isFinite(published) || published >= ms;
  });
}
