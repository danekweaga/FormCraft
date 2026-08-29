const STALLED_ANALYSIS_MS = 15 * 60 * 1000;

/** Kept outside React render modules so server pages can share one cutoff rule. */
export function stalledAnalysisCutoffIso(now = new Date()): string {
  return new Date(now.getTime() - STALLED_ANALYSIS_MS).toISOString();
}
