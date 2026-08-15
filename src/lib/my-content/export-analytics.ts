import {
  getPostEngagementRate,
  summarizeAccountPerformance,
} from "./performance";
import type { ContentPostRow } from "./schemas";

const HEADERS = [
  "platform",
  "title",
  "published_at",
  "views",
  "reach",
  "likes",
  "comments",
  "shares",
  "saves",
  "followers_gained",
  "watch_time_seconds",
  "engagement_rate_pct",
  "engagement_rate_basis",
  "topic",
  "content_pillar",
  "relative_performance",
  "source",
  "external_url",
] as const;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  return csvEscape(value);
}

function relativePerformanceLabel(
  relative: Record<string, unknown> | null | undefined,
): string {
  if (!relative || typeof relative !== "object") return "";
  const label =
    (typeof relative.label === "string" && relative.label) ||
    (typeof relative.band === "string" && relative.band) ||
    (typeof relative.status === "string" && relative.status) ||
    "";
  return label;
}

/** Build an Excel-friendly UTF-8 CSV (BOM prefixed) of owned-post analytics. */
export function buildPerformanceAnalyticsCsv(posts: ContentPostRow[]): string {
  const rows = posts.map((post) => {
    const rate = getPostEngagementRate(post);
    return [
      cell(post.platform),
      cell(post.title),
      cell(post.published_at),
      cell(post.views),
      cell(post.reach ?? null),
      cell(post.likes),
      cell(post.comments),
      cell(post.shares),
      cell(post.saves),
      cell(post.followers_gained),
      cell(post.watch_time_seconds ?? null),
      cell(rate ? Math.round(rate.value * 100) / 100 : null),
      cell(rate?.denominator ?? null),
      cell(post.topic ?? null),
      cell(post.content_pillar ?? null),
      cell(relativePerformanceLabel(post.relative_performance)),
      cell(post.source),
      cell(post.external_url ?? null),
    ].join(",");
  });

  const summary = summarizeAccountPerformance(posts);
  const summaryLines = [
    "# FormCraft performance export",
    `# posts,${summary.postCount}`,
    `# posts_with_metrics,${summary.postsWithMetrics}`,
    `# total_views,${summary.totalViews ?? ""}`,
    `# total_reach,${summary.totalReach ?? ""}`,
    `# median_views,${summary.medianViews ?? ""}`,
    `# engagement_rate_pct,${
      summary.engagementRate
        ? Math.round(summary.engagementRate.value * 100) / 100
        : ""
    }`,
  ];

  return `\uFEFF${[...summaryLines, HEADERS.join(","), ...rows].join("\r\n")}\r\n`;
}

export function performanceExportFilename(range: string, now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  const safeRange = range.replace(/[^a-z0-9]/gi, "") || "all";
  return `formcraft-performance-${safeRange}-${date}.csv`;
}
