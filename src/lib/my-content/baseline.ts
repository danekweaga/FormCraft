import type { ContentPostMetrics, ContentPostRow } from "./schemas";

export type MetricKey = keyof ContentPostMetrics;

const METRIC_KEYS: MetricKey[] = [
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

export type ContentBaselines = Partial<Record<MetricKey, number>>;

export function computeBaselines(posts: ContentPostRow[]): ContentBaselines {
  const baselines: ContentBaselines = {};

  for (const key of METRIC_KEYS) {
    const values = posts
      .map((post) => post[key])
      .filter((value): value is number => value !== null && value !== undefined);
    const med = median(values);
    if (med !== null) baselines[key] = med;
  }

  return baselines;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function getRelativeRank(
  post: ContentPostRow,
  recentPosts: ContentPostRow[],
  metric: MetricKey = "views",
): string | null {
  const postValue = post[metric];
  if (postValue === null || postValue === undefined) return null;

  const ranked = recentPosts
    .filter((p) => p[metric] !== null && p[metric] !== undefined)
    .sort((a, b) => (b[metric] as number) - (a[metric] as number));

  if (ranked.length === 0) return null;

  const index = ranked.findIndex((p) => p.id === post.id);
  if (index === -1) return null;

  return `${ordinal(index + 1)} of your last ${ranked.length} posts`;
}

export function getRelativeMultiplier(
  post: ContentPostRow,
  baselines: ContentBaselines,
  metric: MetricKey = "views",
): string | null {
  const postValue = post[metric];
  const baseline = baselines[metric];
  if (
    postValue === null ||
    postValue === undefined ||
    baseline === undefined ||
    baseline <= 0
  ) {
    return null;
  }

  const ratio = postValue / baseline;
  return `${ratio.toFixed(1)}× your usual ${metric.replace(/_/g, " ")}`;
}

export function buildRelativePerformance(
  post: ContentPostRow,
  recentPosts: ContentPostRow[],
  baselines: ContentBaselines,
): Record<string, string | null> {
  const output: Record<string, string | null> = {};

  for (const key of METRIC_KEYS) {
    output[`${key}_rank`] = getRelativeRank(post, recentPosts, key);
    output[`${key}_multiplier`] = getRelativeMultiplier(post, baselines, key);
  }

  return output;
}

export function shouldFlagWinner(
  post: ContentPostRow,
  baselines: ContentBaselines,
  metric: MetricKey = "views",
): boolean {
  const postValue = post[metric];
  const baseline = baselines[metric];
  if (
    postValue === null ||
    postValue === undefined ||
    baseline === undefined ||
    baseline <= 0
  ) {
    return false;
  }
  return postValue > baseline * 1.5;
}

export function shouldFlagNeedsReview(
  post: ContentPostRow,
  baselines: ContentBaselines,
  metric: MetricKey = "views",
): boolean {
  const postValue = post[metric];
  const baseline = baselines[metric];
  if (
    postValue === null ||
    postValue === undefined ||
    baseline === undefined ||
    baseline <= 0
  ) {
    return false;
  }
  return postValue < baseline * 0.5;
}
