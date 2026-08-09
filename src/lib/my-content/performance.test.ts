import { describe, expect, it } from "vitest";
import type { ContentPostRow } from "./schemas";
import {
  buildPostPerformanceInsights,
  getInstagramEmbedUrl,
  getPostEngagementRate,
  summarizeAccountPerformance,
} from "./performance";

function post(
  id: string,
  metrics: Partial<ContentPostRow> = {},
): ContentPostRow {
  return {
    id,
    platform: "instagram",
    source: "connected_account",
    source_label: "Instagram · Synced",
    title: `Post ${id}`,
    caption: null,
    published_at: "2026-08-09T12:00:00.000Z",
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    followers_gained: null,
    is_winner: false,
    needs_review: false,
    relative_performance: {},
    created_at: "2026-08-09T12:00:00.000Z",
    ...metrics,
  };
}

describe("My Content performance helpers", () => {
  it("builds only allow-listed Instagram embed URLs", () => {
    expect(
      getInstagramEmbedUrl("https://www.instagram.com/reel/ABC_123/?utm_source=test"),
    ).toBe("https://www.instagram.com/reel/ABC_123/embed/");
    expect(getInstagramEmbedUrl("http://www.instagram.com/reel/ABC_123/"))
      .toBeNull();
    expect(getInstagramEmbedUrl("https://example.com/reel/ABC_123/"))
      .toBeNull();
  });

  it("explains only evidence-backed metric outliers", () => {
    const cohort = [
      post("a", { views: 100, shares: 2 }),
      post("b", { views: 120, shares: 3 }),
      post("c", { views: 110, shares: 2 }),
      post("winner", { views: 330, shares: 9 }),
    ];

    const insights = buildPostPerformanceInsights(cohort[3]!, cohort);
    expect(insights[0]?.tone).toBe("positive");
    expect(insights.some((insight) => insight.detail.includes("median"))).toBe(true);
  });

  it("summarizes account totals and top performers from available metrics", () => {
    const posts = [
      post("a", { views: 100, reach: 80, likes: 8, comments: 2, shares: 1, saves: 1 }),
      post("b", { views: 300, reach: 200, likes: 20, comments: 5, shares: 4, saves: 6 }),
    ];

    const summary = summarizeAccountPerformance(posts);
    expect(summary.totalViews).toBe(400);
    expect(summary.totalReach).toBe(280);
    expect(summary.topByViews?.id).toBe("b");
    expect(summary.engagementRate?.denominator).toBe("reach");
    expect(getPostEngagementRate(posts[1]!)?.value).toBeCloseTo(17.5);
    expect(summary.viewDistribution.p75).toBe(250);
    expect(summary.efficiency.find((metric) => metric.label === "Share rate")?.value)
      .toBeCloseTo((5 / 280) * 100);
  });

  it("compares recent cohorts and groups performance by format and weekday", () => {
    const posts = Array.from({ length: 6 }, (_, index) =>
      post(String(index), {
        format: index < 3 ? "video" : "carousel_album",
        published_at: new Date(Date.UTC(2026, 7, 9 - index)).toISOString(),
        views: index < 3 ? 200 : 100,
        reach: index < 3 ? 150 : 80,
        likes: 10,
        comments: 1,
        shares: 1,
        saves: 1,
      }),
    );

    const summary = summarizeAccountPerformance(posts);
    expect(summary.formats.map((item) => item.format)).toEqual([
      "video",
      "carousel album",
    ]);
    expect(summary.recentTrend?.cohortSize).toBe(3);
    expect(summary.recentTrend?.averageViewsChange).toBe(100);
    expect(summary.publishingPatterns.length).toBeGreaterThan(0);
  });
});
