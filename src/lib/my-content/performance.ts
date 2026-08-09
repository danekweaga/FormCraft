import type { ContentPostRow } from "./schemas";

const ENGAGEMENT_KEYS = ["likes", "comments", "shares", "saves"] as const;
const INSIGHT_METRICS = [
  { key: "views", label: "Views", title: "Distribution stood out" },
  { key: "reach", label: "Reach", title: "More people were reached" },
  { key: "shares", label: "Shares", title: "People passed it along" },
  { key: "saves", label: "Saves", title: "People wanted to keep it" },
  { key: "comments", label: "Comments", title: "It created conversation" },
  { key: "likes", label: "Likes", title: "Immediate engagement was stronger" },
] as const;

type InsightMetricKey = (typeof INSIGHT_METRICS)[number]["key"];

export type PerformanceInsight = {
  title: string;
  detail: string;
  tone: "positive" | "neutral" | "warning";
};

export type EngagementRate = {
  value: number;
  denominator: "reach" | "views";
};

export type AccountPerformanceSummary = {
  postCount: number;
  postsWithMetrics: number;
  totalViews: number | null;
  totalReach: number | null;
  totalEngagements: number | null;
  engagementRate: EngagementRate | null;
  medianViews: number | null;
  topByViews: ContentPostRow | null;
  topByEngagementRate: ContentPostRow | null;
  topByShares: ContentPostRow | null;
  topBySaves: ContentPostRow | null;
  topPosts: ContentPostRow[];
  latestMetricsAt: string | null;
  viewDistribution: {
    p25: number | null;
    median: number | null;
    p75: number | null;
    p90: number | null;
    max: number | null;
  };
  efficiency: Array<{
    label: string;
    value: number | null;
    denominator: "reach" | "views" | null;
  }>;
  formats: Array<{
    format: string;
    postCount: number;
    averageViews: number | null;
    averageReach: number | null;
    engagementRate: EngagementRate | null;
  }>;
  publishingPatterns: Array<{
    weekday: string;
    postCount: number;
    averageViews: number | null;
    averageEngagements: number | null;
  }>;
  recentTrend: {
    cohortSize: number;
    averageViewsChange: number | null;
    averageEngagementChange: number | null;
  } | null;
};

function numericMetric(
  post: ContentPostRow,
  key: InsightMetricKey,
): number | null {
  const value = post[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1]! + sorted[midpoint]!) / 2
    : sorted[midpoint]!;
}

function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (index - lower);
}

function average(values: Array<number | null | undefined>): number | null {
  const available = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return available.length === 0
    ? null
    : available.reduce((total, value) => total + value, 0) / available.length;
}

function percentageChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function sumAvailable(values: Array<number | null | undefined>): number | null {
  const available = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return available.length > 0
    ? available.reduce((total, value) => total + value, 0)
    : null;
}

export function getInstagramEmbedUrl(
  externalUrl: string | null | undefined,
): string | null {
  if (!externalUrl) return null;

  try {
    const url = new URL(externalUrl);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      (hostname !== "instagram.com" && hostname !== "www.instagram.com")
    ) {
      return null;
    }

    const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/);
    if (!match) return null;

    return `https://www.instagram.com/${match[1]}/${match[2]}/embed/`;
  } catch {
    return null;
  }
}

export function getPostEngagements(post: ContentPostRow): number | null {
  return sumAvailable(ENGAGEMENT_KEYS.map((key) => post[key]));
}

export function getPostEngagementRate(
  post: ContentPostRow,
): EngagementRate | null {
  const engagements = getPostEngagements(post);
  if (engagements === null) return null;

  const denominator =
    typeof post.reach === "number" && post.reach > 0
      ? { value: post.reach, name: "reach" as const }
      : typeof post.views === "number" && post.views > 0
        ? { value: post.views, name: "views" as const }
        : null;

  if (!denominator) return null;
  return {
    value: (engagements / denominator.value) * 100,
    denominator: denominator.name,
  };
}

export function buildPostPerformanceInsights(
  post: ContentPostRow,
  comparisonPosts: ContentPostRow[],
): PerformanceInsight[] {
  const samePlatform = comparisonPosts.filter(
    (candidate) => candidate.platform === post.platform,
  );
  const cohort = samePlatform.length >= 3 ? samePlatform : comparisonPosts;

  const scored = INSIGHT_METRICS.flatMap((metric) => {
    const value = numericMetric(post, metric.key);
    const values = cohort
      .map((candidate) => numericMetric(candidate, metric.key))
      .filter((candidate): candidate is number => candidate !== null);
    const baseline = median(values);

    if (value === null || baseline === null || baseline <= 0 || values.length < 3) {
      return [];
    }

    return [{ ...metric, value, ratio: value / baseline, sampleSize: values.length }];
  }).sort((a, b) => b.ratio - a.ratio);

  const positive = scored
    .filter((metric) => metric.ratio >= 1.2)
    .slice(0, 3)
    .map<PerformanceInsight>((metric) => ({
      title: metric.title,
      detail: `${metric.label} were ${metric.ratio.toFixed(1)}x your median across ${metric.sampleSize} comparable posts.`,
      tone: "positive",
    }));

  if (positive.length > 0) return positive;

  const strongest = scored[0];
  if (strongest) {
    const tone = strongest.ratio < 0.75 ? "warning" : "neutral";
    return [
      {
        title:
          tone === "warning"
            ? "No positive performance outlier yet"
            : "Performance was close to your usual range",
        detail: `${strongest.label} were ${strongest.ratio.toFixed(1)}x your median across ${strongest.sampleSize} comparable posts.`,
        tone,
      },
    ];
  }

  return [
    {
      title: "More history is needed",
      detail:
        "FormCraft needs at least three comparable posts with the same metric before it can make a reliable comparison.",
      tone: "neutral",
    },
  ];
}

export function summarizeAccountPerformance(
  posts: ContentPostRow[],
): AccountPerformanceSummary {
  const totalViews = sumAvailable(posts.map((post) => post.views));
  const totalReach = sumAvailable(posts.map((post) => post.reach));
  const engagementValues = posts.map(getPostEngagements);
  const totalEngagements = sumAvailable(engagementValues);
  const postsWithMetrics = posts.filter((post) =>
    INSIGHT_METRICS.some((metric) => numericMetric(post, metric.key) !== null),
  ).length;
  const medianViews = median(
    posts
      .map((post) => post.views)
      .filter((value): value is number => typeof value === "number"),
  );
  const viewValues = posts
    .map((post) => post.views)
    .filter((value): value is number => typeof value === "number");

  const topPosts = posts
    .filter((post) => typeof post.views === "number")
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 5);

  let topByEngagementRate: ContentPostRow | null = null;
  let topEngagementRate = -1;
  for (const post of posts) {
    const rate = getPostEngagementRate(post);
    if (rate && rate.value > topEngagementRate) {
      topByEngagementRate = post;
      topEngagementRate = rate.value;
    }
  }

  const aggregateDenominator =
    totalReach !== null && totalReach > 0
      ? { value: totalReach, name: "reach" as const }
      : totalViews !== null && totalViews > 0
        ? { value: totalViews, name: "views" as const }
        : null;
  const engagementRate =
    totalEngagements !== null && aggregateDenominator
      ? {
          value: (totalEngagements / aggregateDenominator.value) * 100,
          denominator: aggregateDenominator.name,
        }
      : null;

  const metricDates = posts
    .map((post) => post.metrics_refreshed_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const ratioDenominator =
    totalReach !== null && totalReach > 0
      ? { value: totalReach, name: "reach" as const }
      : totalViews !== null && totalViews > 0
        ? { value: totalViews, name: "views" as const }
        : null;
  const efficiency = [
    { label: "Like rate", values: posts.map((post) => post.likes) },
    { label: "Comment rate", values: posts.map((post) => post.comments) },
    { label: "Share rate", values: posts.map((post) => post.shares) },
    { label: "Save rate", values: posts.map((post) => post.saves) },
  ].map((metric) => {
    const total = sumAvailable(metric.values);
    return {
      label: metric.label,
      value:
        total !== null && ratioDenominator
          ? (total / ratioDenominator.value) * 100
          : null,
      denominator: ratioDenominator?.name ?? null,
    };
  });

  const formatGroups = new Map<string, ContentPostRow[]>();
  for (const post of posts) {
    const format = post.format?.replace(/_/g, " ") ?? "unknown";
    formatGroups.set(format, [...(formatGroups.get(format) ?? []), post]);
  }
  const formats = [...formatGroups.entries()]
    .map(([format, formatPosts]) => {
      const totalFormatEngagements = sumAvailable(
        formatPosts.map(getPostEngagements),
      );
      const totalFormatReach = sumAvailable(formatPosts.map((post) => post.reach));
      const totalFormatViews = sumAvailable(formatPosts.map((post) => post.views));
      const denominator =
        totalFormatReach !== null && totalFormatReach > 0
          ? { value: totalFormatReach, name: "reach" as const }
          : totalFormatViews !== null && totalFormatViews > 0
            ? { value: totalFormatViews, name: "views" as const }
            : null;
      return {
        format,
        postCount: formatPosts.length,
        averageViews: average(formatPosts.map((post) => post.views)),
        averageReach: average(formatPosts.map((post) => post.reach)),
        engagementRate:
          totalFormatEngagements !== null && denominator
            ? {
                value: (totalFormatEngagements / denominator.value) * 100,
                denominator: denominator.name,
              }
            : null,
      };
    })
    .sort((a, b) => b.postCount - a.postCount);

  const weekdayGroups = new Map<string, ContentPostRow[]>();
  for (const post of posts) {
    if (!post.published_at) continue;
    const date = new Date(post.published_at);
    if (Number.isNaN(date.getTime())) continue;
    const weekday = new Intl.DateTimeFormat("en", { weekday: "long" }).format(date);
    weekdayGroups.set(weekday, [...(weekdayGroups.get(weekday) ?? []), post]);
  }
  const publishingPatterns = [...weekdayGroups.entries()]
    .map(([weekday, weekdayPosts]) => ({
      weekday,
      postCount: weekdayPosts.length,
      averageViews: average(weekdayPosts.map((post) => post.views)),
      averageEngagements: average(weekdayPosts.map(getPostEngagements)),
    }))
    .sort((a, b) => (b.averageViews ?? -1) - (a.averageViews ?? -1));

  const datedPosts = [...posts].sort(
    (a, b) =>
      new Date(b.published_at ?? 0).getTime() -
      new Date(a.published_at ?? 0).getTime(),
  );
  const cohortSize = Math.min(10, Math.floor(datedPosts.length / 2));
  const recent = datedPosts.slice(0, cohortSize);
  const previous = datedPosts.slice(cohortSize, cohortSize * 2);
  const recentTrend =
    cohortSize >= 3
      ? {
          cohortSize,
          averageViewsChange: percentageChange(
            average(recent.map((post) => post.views)),
            average(previous.map((post) => post.views)),
          ),
          averageEngagementChange: percentageChange(
            average(recent.map(getPostEngagements)),
            average(previous.map(getPostEngagements)),
          ),
        }
      : null;

  const topBy = (key: "shares" | "saves") =>
    [...posts]
      .filter((post) => typeof post[key] === "number")
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))[0] ?? null;

  return {
    postCount: posts.length,
    postsWithMetrics,
    totalViews,
    totalReach,
    totalEngagements,
    engagementRate,
    medianViews,
    topByViews: topPosts[0] ?? null,
    topByEngagementRate,
    topByShares: topBy("shares"),
    topBySaves: topBy("saves"),
    topPosts,
    latestMetricsAt: metricDates[0] ?? null,
    viewDistribution: {
      p25: percentile(viewValues, 0.25),
      median: medianViews,
      p75: percentile(viewValues, 0.75),
      p90: percentile(viewValues, 0.9),
      max: viewValues.length > 0 ? Math.max(...viewValues) : null,
    },
    efficiency,
    formats,
    publishingPatterns,
    recentTrend,
  };
}
