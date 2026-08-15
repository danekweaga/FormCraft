import { describe, expect, it } from "vitest";
import {
  buildGrowthSeries,
  buildYearHeatmap,
  formatCompact,
  toDayKey,
  type MetricSnapshotRow,
} from "./growth-series";
import type { ContentPostRow } from "./schemas";

const NOW = new Date("2026-08-09T12:00:00.000Z");

function post(
  overrides: Partial<ContentPostRow> & { id: string },
): ContentPostRow {
  return {
    platform: "youtube",
    source: "synced",
    source_label: "YouTube",
    title: "Post",
    caption: null,
    topic: null,
    content_pillar: null,
    hook_text: null,
    classification: null,
    format: null,
    published_at: "2026-08-05T00:00:00.000Z",
    views: 100,
    likes: 10,
    comments: 5,
    shares: null,
    saves: null,
    followers_gained: 2,
    ...overrides,
  } as ContentPostRow;
}

describe("toDayKey", () => {
  it("buckets by UTC day", () => {
    expect(toDayKey("2026-08-05T23:30:00.000Z")).toBe("2026-08-05");
  });
});

describe("buildGrowthSeries", () => {
  it("attributes lifetime views to the publish date when no snapshots exist", () => {
    const series = buildGrowthSeries({
      posts: [
        post({ id: "a", published_at: "2026-08-05T10:00:00.000Z", views: 400 }),
        post({ id: "b", published_at: "2026-08-05T18:00:00.000Z", views: 600 }),
        post({ id: "c", published_at: "2026-08-08T09:00:00.000Z", views: 250 }),
      ],
      metric: "impressions",
      days: 7,
      now: NOW,
    });

    expect(series.basis).toBe("publish_date_attribution");
    expect(series.points).toHaveLength(7);
    expect(series.total).toBe(1250);
    expect(series.points.at(-1)?.date).toBe("2026-08-09");

    const aug5 = series.points.find((point) => point.date === "2026-08-05");
    expect(aug5?.value).toBe(1000);
    expect(aug5?.posts).toHaveLength(2);
    expect(series.bestDay?.date).toBe("2026-08-05");
  });

  it("prefers measured daily change when snapshot history exists", () => {
    const snapshots: MetricSnapshotRow[] = [
      { content_post_id: "a", captured_at: "2026-08-06T00:00:00.000Z", views: 100 },
      { content_post_id: "a", captured_at: "2026-08-07T00:00:00.000Z", views: 400 },
      { content_post_id: "a", captured_at: "2026-08-08T00:00:00.000Z", views: 450 },
    ];
    const series = buildGrowthSeries({
      posts: [post({ id: "a", views: 450 })],
      snapshots,
      metric: "impressions",
      days: 7,
      now: NOW,
    });

    expect(series.basis).toBe("measured_daily_change");
    expect(series.points.find((p) => p.date === "2026-08-07")?.value).toBe(300);
    expect(series.points.find((p) => p.date === "2026-08-08")?.value).toBe(50);
    expect(series.total).toBe(350);
  });

  it("ignores negative metric corrections instead of plotting them", () => {
    const snapshots: MetricSnapshotRow[] = [
      { content_post_id: "a", captured_at: "2026-08-05T00:00:00.000Z", views: 900 },
      { content_post_id: "a", captured_at: "2026-08-06T00:00:00.000Z", views: 500 },
      { content_post_id: "a", captured_at: "2026-08-07T00:00:00.000Z", views: 700 },
      { content_post_id: "a", captured_at: "2026-08-08T00:00:00.000Z", views: 800 },
    ];
    const series = buildGrowthSeries({
      posts: [post({ id: "a" })],
      snapshots,
      metric: "impressions",
      days: 7,
      now: NOW,
    });
    expect(series.basis).toBe("measured_daily_change");
    expect(series.total).toBe(300);
    expect(series.points.find((p) => p.date === "2026-08-06")?.value).toBe(0);
    expect(series.points.find((p) => p.date === "2026-08-07")?.value).toBe(200);
  });

  it("falls back to publish attribution when snapshot history is too thin", () => {
    const series = buildGrowthSeries({
      posts: [post({ id: "a", views: 100 })],
      snapshots: [
        { content_post_id: "a", captured_at: "2026-08-06T00:00:00.000Z", views: 40 },
        { content_post_id: "a", captured_at: "2026-08-07T00:00:00.000Z", views: 100 },
      ],
      metric: "impressions",
      days: 7,
      now: NOW,
    });
    expect(series.basis).toBe("publish_date_attribution");
    expect(series.total).toBe(100);
  });

  it("falls back to publish attribution when snapshot deltas under-count lifetime views", () => {
    const snapshots: MetricSnapshotRow[] = [
      { content_post_id: "a", captured_at: "2026-08-06T00:00:00.000Z", views: 10_000 },
      { content_post_id: "a", captured_at: "2026-08-07T00:00:00.000Z", views: 10_020 },
      { content_post_id: "a", captured_at: "2026-08-08T00:00:00.000Z", views: 10_040 },
      { content_post_id: "a", captured_at: "2026-08-09T00:00:00.000Z", views: 10_050 },
    ];
    const series = buildGrowthSeries({
      posts: [post({ id: "a", views: 10_050 })],
      snapshots,
      metric: "impressions",
      days: 7,
      now: NOW,
    });
    expect(series.basis).toBe("publish_date_attribution");
    expect(series.total).toBe(10_050);
  });

  it("uses followers_gained for the followers metric", () => {
    const series = buildGrowthSeries({
      posts: [
        post({ id: "a", followers_gained: 12 }),
        post({ id: "b", followers_gained: null }),
      ],
      metric: "followers",
      days: 7,
      now: NOW,
    });
    expect(series.total).toBe(12);
    expect(series.basis).toBe("publish_date_attribution");
  });

  it("can plot Instagram account follower totals via externalDaily", () => {
    const series = buildGrowthSeries({
      posts: [post({ id: "a", followers_gained: null })],
      metric: "followers",
      days: 3,
      now: NOW,
      externalDaily: new Map([
        ["2026-08-07", 1000],
        ["2026-08-08", 1010],
        ["2026-08-09", 1025],
      ]),
      externalBasis: "account_daily_followers",
    });
    expect(series.basis).toBe("account_daily_followers");
    expect(series.total).toBe(1025);
    expect(series.points.at(-1)?.value).toBe(1025);
  });

  it("returns zero-valued days rather than gaps", () => {
    const series = buildGrowthSeries({
      posts: [post({ id: "a", published_at: "2026-08-09T00:00:00.000Z" })],
      metric: "impressions",
      days: 3,
      now: NOW,
    });
    expect(series.points.map((p) => p.date)).toEqual([
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
    ]);
    expect(series.points[0]?.value).toBe(0);
  });
});

describe("buildYearHeatmap", () => {
  it("builds an aligned week grid with month labels", () => {
    const heatmap = buildYearHeatmap({
      posts: [post({ id: "a", views: 1000 })],
      metric: "impressions",
      now: NOW,
      weeks: 53,
    });

    expect(heatmap.weeks).toHaveLength(53);
    expect(heatmap.weeks.every((week) => week.cells.length === 7)).toBe(true);
    expect(heatmap.total).toBe(1000);
    expect(heatmap.monthLabels.length).toBeGreaterThan(0);

    const cells = heatmap.weeks.flatMap((week) => week.cells);
    const aug5 = cells.find((cell) => cell?.date === "2026-08-05");
    expect(aug5?.level).toBeGreaterThan(0);
    expect(aug5?.postCount).toBe(1);
  });

  it("marks days after today as future", () => {
    const heatmap = buildYearHeatmap({
      posts: [post({ id: "a" })],
      metric: "impressions",
      now: NOW,
    });
    const cells = heatmap.weeks.flatMap((week) => week.cells);
    expect(cells.find((cell) => cell?.date === "2026-08-10")?.future).toBe(true);
    expect(cells.find((cell) => cell?.date === "2026-08-09")?.future).toBe(false);
  });
});

describe("formatCompact", () => {
  it("shortens large numbers", () => {
    expect(formatCompact(17_107)).toBe("17.1k");
    expect(formatCompact(950)).toBe("950");
    expect(formatCompact(2_400_000)).toBe("2.4M");
  });
});
