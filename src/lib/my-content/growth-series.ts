import type { ContentPostRow } from "./schemas";

export type GrowthMetric = "impressions" | "followers";

/**
 * How a daily number was derived. Shown in the UI so a chart point is never
 * mistaken for a platform-reported daily breakdown.
 */
export type GrowthBasis =
  | "measured_daily_change"
  | "publish_date_attribution"
  | "account_daily_followers"
  | "account_period_follows"
  | "account_daily_views"
  | "account_period_views";

export type MetricSnapshotRow = {
  content_post_id: string;
  captured_at: string;
  views: number | null;
  followers_gained?: number | null;
};

export type GrowthPointPost = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  views: number | null;
  engagements: number | null;
};

export type GrowthPoint = {
  date: string;
  value: number;
  posts: GrowthPointPost[];
};

export type GrowthSeries = {
  metric: GrowthMetric;
  basis: GrowthBasis;
  points: GrowthPoint[];
  total: number;
  bestDay: GrowthPoint | null;
  postCount: number;
};

export type HeatmapCell = {
  date: string;
  value: number;
  postCount: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
};

export type HeatmapWeek = { cells: Array<HeatmapCell | null> };

export type Heatmap = {
  metric: GrowthMetric;
  basis: GrowthBasis;
  weeks: HeatmapWeek[];
  monthLabels: Array<{ index: number; label: string }>;
  total: number;
};

const DAY_MS = 86_400_000;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** UTC day key so server and client bucket identically. */
export function toDayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dayKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function metricValue(post: ContentPostRow, metric: GrowthMetric): number | null {
  return metric === "impressions" ? post.views : post.followers_gained;
}

function engagementsOf(post: ContentPostRow): number | null {
  const parts = [post.likes, post.comments, post.shares, post.saves].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (parts.length === 0) return null;
  return parts.reduce((total, value) => total + value, 0);
}

function postLabel(post: ContentPostRow): string {
  return (
    post.title?.trim() ||
    post.caption?.trim().slice(0, 80) ||
    "Untitled post"
  );
}

function buildPostsByDay(
  posts: ContentPostRow[],
): Map<string, GrowthPointPost[]> {
  const map = new Map<string, GrowthPointPost[]>();
  for (const post of posts) {
    if (!post.published_at) continue;
    const key = toDayKey(post.published_at);
    if (!key) continue;
    map.set(key, [
      ...(map.get(key) ?? []),
      {
        id: post.id,
        title: postLabel(post),
        thumbnailUrl: post.thumbnail_url ?? null,
        views: post.views,
        engagements: engagementsOf(post),
      },
    ]);
  }
  return map;
}

/**
 * Daily change measured from consecutive metric snapshots of the same post.
 * Returns null when there is not enough snapshot history to be meaningful.
 */
function buildMeasuredDailyTotals(
  snapshots: MetricSnapshotRow[],
): Map<string, number> | null {
  const byPost = new Map<string, MetricSnapshotRow[]>();
  for (const snapshot of snapshots) {
    if (typeof snapshot.views !== "number") continue;
    byPost.set(snapshot.content_post_id, [
      ...(byPost.get(snapshot.content_post_id) ?? []),
      snapshot,
    ]);
  }

  const totals = new Map<string, number>();
  let deltaCount = 0;

  for (const rows of byPost.values()) {
    const ordered = [...rows].sort(
      (a, b) =>
        new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
    );
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1]!;
      const current = ordered[index]!;
      const delta = (current.views as number) - (previous.views as number);
      // Ignore negative corrections rather than inventing a shape for them.
      if (delta <= 0) continue;
      const key = toDayKey(current.captured_at);
      if (!key) continue;
      totals.set(key, (totals.get(key) ?? 0) + delta);
      deltaCount += 1;
    }
  }

  if (deltaCount === 0 || totals.size < 2) return null;
  return totals;
}

function mapTotal(values: Map<string, number>): number {
  let total = 0;
  for (const value of values.values()) total += value;
  return total;
}

/**
 * Snapshot deltas are preferred only when they cover enough days and aren't a
 * near-empty under-count of lifetime views (common after a few syncs).
 */
export function shouldPreferMeasuredDailyChange(
  measured: Map<string, number>,
  attributed: Map<string, number>,
): boolean {
  const measuredTotal = mapTotal(measured);
  const attributedTotal = mapTotal(attributed);
  if (measured.size < 2 || measuredTotal <= 0) return false;
  if (attributedTotal <= 0) return true;
  return measuredTotal >= Math.max(50, attributedTotal * 0.2);
}

export function buildGrowthSeries(params: {
  posts: ContentPostRow[];
  snapshots?: MetricSnapshotRow[];
  metric: GrowthMetric;
  days: number;
  now?: Date;
  /** Optional absolute/daily series override (e.g. Instagram account insights). */
  externalDaily?: Map<string, number> | null;
  externalBasis?: GrowthBasis;
  /** How to roll external daily points into `total`. Defaults to sum. */
  externalTotalMode?: "sum" | "latest";
}): GrowthSeries {
  const { posts, snapshots = [], metric, days } = params;
  const now = params.now ?? new Date();
  const endKey = toDayKey(now);
  const end = dayKeyToDate(endKey);
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);

  const postsByDay = buildPostsByDay(posts);

  const attributed = new Map<string, number>();
  for (const post of posts) {
    if (!post.published_at) continue;
    const value = metricValue(post, metric);
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const key = toDayKey(post.published_at);
    if (!key) continue;
    attributed.set(key, (attributed.get(key) ?? 0) + value);
  }

  const measured =
    metric === "impressions" && !params.externalDaily
      ? buildMeasuredDailyTotals(snapshots)
      : null;

  let basis: GrowthBasis = "publish_date_attribution";
  let source: Map<string, number> = attributed;
  let totalMode: "sum" | "latest" = "sum";

  if (params.externalDaily && params.externalDaily.size > 0) {
    basis = params.externalBasis ?? "account_daily_followers";
    source = params.externalDaily;
    totalMode = params.externalTotalMode ?? "sum";
  } else if (measured && shouldPreferMeasuredDailyChange(measured, attributed)) {
    basis = "measured_daily_change";
    source = measured;
  }

  const points: GrowthPoint[] = [];
  let postCount = 0;

  for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) {
    const key = toDayKey(new Date(time));
    const dayPosts = postsByDay.get(key) ?? [];
    postCount += dayPosts.length;
    points.push({
      date: key,
      value: source.get(key) ?? 0,
      posts: dayPosts,
    });
  }

  const total =
    totalMode === "latest"
      ? [...points].reverse().find((point) => point.value > 0)?.value ?? 0
      : points.reduce((sum, point) => sum + point.value, 0);
  const bestDay = points.reduce<GrowthPoint | null>(
    (best, point) =>
      point.value > 0 && (!best || point.value > best.value) ? point : best,
    null,
  );

  return { metric, basis, points, total, bestDay, postCount };
}

function levelFor(value: number, thresholds: number[]): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0;
  if (value <= thresholds[0]!) return 1;
  if (value <= thresholds[1]!) return 2;
  if (value <= thresholds[2]!) return 3;
  return 4;
}

export function buildYearHeatmap(params: {
  posts: ContentPostRow[];
  snapshots?: MetricSnapshotRow[];
  metric: GrowthMetric;
  now?: Date;
  weeks?: number;
}): Heatmap {
  const weekCount = params.weeks ?? 53;
  const now = params.now ?? new Date();
  const series = buildGrowthSeries({
    posts: params.posts,
    snapshots: params.snapshots,
    metric: params.metric,
    days: weekCount * 7,
    now,
  });

  const byDate = new Map(series.points.map((point) => [point.date, point]));
  const endKey = toDayKey(now);
  const end = dayKeyToDate(endKey);

  // Grid ends on the Saturday of the current week so columns stay aligned.
  const endOfWeek = new Date(end.getTime() + (6 - end.getUTCDay()) * DAY_MS);
  const gridStart = new Date(
    endOfWeek.getTime() - (weekCount * 7 - 1) * DAY_MS,
  );

  const values = series.points
    .map((point) => point.value)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const thresholds =
    values.length === 0
      ? [0, 0, 0]
      : [
          values[Math.floor(values.length * 0.25)] ?? values[0]!,
          values[Math.floor(values.length * 0.5)] ?? values[0]!,
          values[Math.floor(values.length * 0.75)] ?? values[0]!,
        ];

  const weeks: HeatmapWeek[] = [];
  const monthLabels: Array<{ index: number; label: string }> = [];
  let lastMonth = -1;

  for (let week = 0; week < weekCount; week += 1) {
    const cells: Array<HeatmapCell | null> = [];
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(gridStart.getTime() + (week * 7 + day) * DAY_MS);
      const key = toDayKey(date);
      const future = date.getTime() > end.getTime();
      const point = byDate.get(key);
      cells.push({
        date: key,
        value: point?.value ?? 0,
        postCount: point?.posts.length ?? 0,
        level: future ? 0 : levelFor(point?.value ?? 0, thresholds),
        future,
      });

      if (day === 0) {
        const month = date.getUTCMonth();
        if (month !== lastMonth) {
          monthLabels.push({ index: week, label: MONTHS[month]! });
          lastMonth = month;
        }
      }
    }
    weeks.push({ cells });
  }

  return {
    metric: params.metric,
    basis: series.basis,
    weeks,
    monthLabels,
    total: series.total,
  };
}

/** ISO timestamp for how far back to load metric snapshots. */
export function snapshotWindowStart(days = 400): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

export function growthBasisLabel(basis: GrowthBasis): string {
  if (basis === "measured_daily_change") {
    return "Measured daily change between metric snapshots";
  }
  if (basis === "account_daily_followers") {
    return "Daily follower change from Instagram account follower totals";
  }
  if (basis === "account_period_follows") {
    return "Period follows from Instagram account insights";
  }
  if (basis === "account_daily_views") {
    return "Daily account views from Instagram insights";
  }
  if (basis === "account_period_views") {
    return "Period account views from Instagram insights";
  }
  return "Lifetime metrics credited to each post's publish date";
}

export function metricLabel(metric: GrowthMetric): string {
  return metric === "impressions" ? "impressions" : "followers gained";
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

export function formatDayLabel(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDayLabel(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
