/**
 * Global discovery-feed policy. Research can retain lower-view posts for
 * creator baselines, but the product never presents them as inspiration.
 */
export const MIN_RESEARCH_VIEWS = 20_000;

export function meetsResearchViewFloor(
  value: number | null | undefined,
): boolean {
  return typeof value === "number" && value >= MIN_RESEARCH_VIEWS;
}
