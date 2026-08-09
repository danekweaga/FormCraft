import type { ContentPostMetrics } from "@/lib/my-content/schemas";

export type BaselineWindow = "last_10" | "last_20" | "last_30" | "last_90_days";

export type WindowBaselines = {
  window: BaselineWindow;
  sampleSize: number;
  medians: Partial<Record<keyof ContentPostMetrics, number | null>>;
};

type MetricPost = ContentPostMetrics & {
  id: string;
  published_at: string | null;
};

const METRIC_KEYS: (keyof ContentPostMetrics)[] = [
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "followers_gained",
];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function selectWindow(posts: MetricPost[], window: BaselineWindow): MetricPost[] {
  const dated = [...posts].sort((a, b) => {
    const at = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bt = b.published_at ? new Date(b.published_at).getTime() : 0;
    return bt - at;
  });

  if (window === "last_10") return dated.slice(0, 10);
  if (window === "last_20") return dated.slice(0, 20);
  if (window === "last_30") return dated.slice(0, 30);

  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  return dated.filter((p) => {
    if (!p.published_at) return false;
    return new Date(p.published_at).getTime() >= cutoff;
  });
}

export function computeWindowBaselines(
  posts: MetricPost[],
  window: BaselineWindow = "last_30",
): WindowBaselines {
  const selected = selectWindow(posts, window);
  const medians: WindowBaselines["medians"] = {};
  for (const key of METRIC_KEYS) {
    const values = selected
      .map((p) => p[key])
      .filter((v): v is number => v !== null && v !== undefined);
    medians[key] = median(values);
  }
  return { window, sampleSize: selected.length, medians };
}

export function personalOutlierMultiplier(
  value: number | null | undefined,
  baseline: number | null | undefined,
): number | null {
  if (
    value === null ||
    value === undefined ||
    baseline === null ||
    baseline === undefined ||
    baseline <= 0
  ) {
    return null;
  }
  return value / baseline;
}

export function formatOutlierMultiplier(ratio: number | null): string | null {
  if (ratio === null) return null;
  return `${ratio.toFixed(1)}× baseline`;
}
