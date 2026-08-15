import * as XLSX from "xlsx";
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

function postRow(post: ContentPostRow): Record<(typeof HEADERS)[number], string | number> {
  const rate = getPostEngagementRate(post);
  return {
    platform: post.platform ?? "",
    title: post.title ?? "",
    published_at: post.published_at ?? "",
    views: post.views ?? "",
    reach: post.reach ?? "",
    likes: post.likes ?? "",
    comments: post.comments ?? "",
    shares: post.shares ?? "",
    saves: post.saves ?? "",
    followers_gained: post.followers_gained ?? "",
    watch_time_seconds: post.watch_time_seconds ?? "",
    engagement_rate_pct: rate ? Math.round(rate.value * 100) / 100 : "",
    engagement_rate_basis: rate?.denominator ?? "",
    topic: post.topic ?? "",
    content_pillar: post.content_pillar ?? "",
    relative_performance: relativePerformanceLabel(post.relative_performance),
    source: post.source ?? "",
    external_url: post.external_url ?? "",
  };
}

/** Build a real Excel workbook (.xlsx) with Posts + Summary sheets. */
export function buildPerformanceAnalyticsXlsx(posts: ContentPostRow[]): Buffer {
  const summary = summarizeAccountPerformance(posts);
  const workbook = XLSX.utils.book_new();

  const postsSheet = XLSX.utils.json_to_sheet(
    posts.map((post) => postRow(post)),
    { header: [...HEADERS] },
  );
  XLSX.utils.book_append_sheet(workbook, postsSheet, "Posts");

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Metric", "Value"],
    ["posts", summary.postCount],
    ["posts_with_metrics", summary.postsWithMetrics],
    ["total_views", summary.totalViews ?? ""],
    ["total_reach", summary.totalReach ?? ""],
    ["median_views", summary.medianViews ?? ""],
    [
      "engagement_rate_pct",
      summary.engagementRate
        ? Math.round(summary.engagementRate.value * 100) / 100
        : "",
    ],
    [
      "engagement_rate_basis",
      summary.engagementRate?.denominator ?? "",
    ],
  ]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  const raw = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
}

/** @deprecated Prefer buildPerformanceAnalyticsXlsx — kept for tests. */
export function buildPerformanceAnalyticsCsv(posts: ContentPostRow[]): string {
  const rows = posts.map((post) => {
    const row = postRow(post);
    return HEADERS.map((key) => {
      const value = row[key];
      const text = value === null || value === undefined ? "" : String(value);
      if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
      return text;
    }).join(",");
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
  return `formcraft-performance-${safeRange}-${date}.xlsx`;
}
