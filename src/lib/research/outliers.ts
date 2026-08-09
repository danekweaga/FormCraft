import type {
  ResearchVideoCandidate,
  ScoredResearchVideo,
} from "./types";

export type OutlierLabel =
  | "below_baseline"
  | "typical"
  | "emerging"
  | "strong_outlier"
  | "exceptional";

export type BaselineConfidence = "low" | "medium" | "high";

export type VelocityLabel =
  | "accelerating"
  | "stable"
  | "slowing"
  | "emerging"
  | "confirmed"
  | "cooling";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

export function baselineConfidence(sampleSize: number): BaselineConfidence {
  if (sampleSize >= 15) return "high";
  if (sampleSize >= 5) return "medium";
  return "low";
}

export function outlierLabel(multiplier: number | null): OutlierLabel | null {
  if (multiplier == null || !Number.isFinite(multiplier)) return null;
  if (multiplier < 0.8) return "below_baseline";
  if (multiplier < 1.5) return "typical";
  if (multiplier < 2.5) return "emerging";
  if (multiplier < 5) return "strong_outlier";
  return "exceptional";
}

export function outlierLabelDisplay(label: OutlierLabel | null): string {
  switch (label) {
    case "below_baseline":
      return "Below baseline";
    case "typical":
      return "Typical";
    case "emerging":
      return "Emerging";
    case "strong_outlier":
      return "Strong outlier";
    case "exceptional":
      return "Exceptional";
    default:
      return "Unscored";
  }
}

/** Simple velocity from ordered snapshots (oldest → newest). */
export function calculateVelocityLabel(
  snapshots: Array<{ views: number | null; capturedAt: string }>,
): VelocityLabel | null {
  const usable = snapshots
    .filter((s) => typeof s.views === "number")
    .sort(
      (a, b) =>
        new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
    );
  if (usable.length < 2) return null;
  const first = usable[0]!.views as number;
  const last = usable[usable.length - 1]!.views as number;
  if (first <= 0) return last > 0 ? "emerging" : null;
  const growth = (last - first) / first;
  const hours =
    (new Date(usable[usable.length - 1]!.capturedAt).getTime() -
      new Date(usable[0]!.capturedAt).getTime()) /
    3_600_000;
  if (hours < 1) return "emerging";
  if (growth > 0.35) return "accelerating";
  if (growth < -0.1) return "cooling";
  if (growth < 0.05) return "slowing";
  return "stable";
}

export function scoreResearchOutliers(
  candidates: ResearchVideoCandidate[],
): ScoredResearchVideo[] {
  const cohortViews = candidates
    .map((candidate) => candidate.views)
    .filter((value): value is number => typeof value === "number");
  const cohortMedian = median(cohortViews);
  const byCreator = new Map<string, number[]>();

  for (const candidate of candidates) {
    if (!candidate.creatorId || typeof candidate.views !== "number") continue;
    byCreator.set(candidate.creatorId, [
      ...(byCreator.get(candidate.creatorId) ?? []),
      candidate.views,
    ]);
  }

  return candidates
    .map((candidate) => {
      const creatorViews = candidate.creatorId
        ? (byCreator.get(candidate.creatorId) ?? [])
        : [];
      const useCreatorBaseline = creatorViews.length >= 3;
      const sampleSize = useCreatorBaseline
        ? creatorViews.length
        : cohortViews.length;
      const baseline = useCreatorBaseline ? median(creatorViews) : cohortMedian;
      const outlierScore =
        typeof candidate.views === "number" && baseline && baseline > 0
          ? candidate.views / baseline
          : null;
      const confidence = baselineConfidence(sampleSize);

      return {
        ...candidate,
        baselineViews: baseline,
        outlierScore,
        scoreBasis: baseline
          ? useCreatorBaseline
            ? ("creator_median" as const)
            : ("niche_cohort_median" as const)
          : ("unavailable" as const),
        baselineSampleSize: sampleSize,
        baselineConfidence: confidence,
        outlierLabel: outlierLabel(outlierScore),
      };
    })
    .sort((a, b) => (b.outlierScore ?? -1) - (a.outlierScore ?? -1));
}

export { median as medianViews };
