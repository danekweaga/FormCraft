export const DAILY_RESEARCH_SCAN_UTC_HOUR = 12;

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
