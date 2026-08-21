import type { ReportFrequency } from "./types";

function validDay(value: unknown, fallback: number, max: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= max ? number : fallback;
}

/** UTC calculation with timezone stored for display. A future scheduler can add full IANA conversion. */
export function calculateNextReportRun(params: {
  frequency: ReportFrequency;
  scheduleConfig?: Record<string, unknown>;
  from?: Date;
}): string | null {
  if (params.frequency === "manual") return null;
  const from = params.from ?? new Date();
  const hour = validDay(params.scheduleConfig?.hour, 12, 23);
  const minute = validDay(params.scheduleConfig?.minute, 0, 59);
  const next = new Date(from);
  next.setUTCSeconds(0, 0);
  next.setUTCHours(hour, minute, 0, 0);

  if (params.frequency === "daily") {
    if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString();
  }

  if (params.frequency === "weekly") {
    const targetDay = validDay(params.scheduleConfig?.weekday, 0, 6);
    let delta = (targetDay - next.getUTCDay() + 7) % 7;
    if (delta === 0 && next <= from) delta = 7;
    next.setUTCDate(next.getUTCDate() + delta);
    return next.toISOString();
  }

  const dayOfMonth = Math.max(1, validDay(params.scheduleConfig?.dayOfMonth, 1, 28));
  next.setUTCDate(dayOfMonth);
  if (next <= from) {
    next.setUTCMonth(next.getUTCMonth() + 1, dayOfMonth);
  }
  return next.toISOString();
}
