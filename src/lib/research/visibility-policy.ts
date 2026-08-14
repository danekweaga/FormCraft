/**
 * Outliers / inspiration tabs keep a hard floor so weak posts stay for
 * baselines only. For You is looser so new niche discovery can appear.
 */
export const MIN_RESEARCH_VIEWS = 20_000;
/** Soft floor for For You search hits; null views (common on IG) stay visible. */
export const MIN_FOR_YOU_VIEWS = 5_000;

export function meetsResearchViewFloor(
  value: number | null | undefined,
): boolean {
  return typeof value === "number" && value >= MIN_RESEARCH_VIEWS;
}

export function meetsForYouViewFloor(
  value: number | null | undefined,
): boolean {
  if (value == null) return true;
  return typeof value === "number" && value >= MIN_FOR_YOU_VIEWS;
}
