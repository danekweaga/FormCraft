import { describe, expect, it } from "vitest";
import {
  buildAccountFollowerSeries,
  buildCumulativePoints,
  buildDashboardTopicAudits,
  filterPostsByPreviousRange,
  percentageChange,
} from "./account-dashboard";
import type { ContentPostRow } from "./schemas";

function post(overrides: Partial<ContentPostRow>): ContentPostRow {
  return {
    id: crypto.randomUUID(),
    platform: "instagram",
    source: "connected_account",
    source_label: "Instagram",
    title: "Post",
    caption: "Hook. Body",
    published_at: "2026-08-08T12:00:00.000Z",
    views: 100,
    likes: 10,
    comments: 2,
    shares: 1,
    saves: 1,
    followers_gained: null,
    is_winner: false,
    needs_review: false,
    relative_performance: {},
    created_at: "2026-08-08T12:00:00.000Z",
    ...overrides,
  };
}

describe("account dashboard", () => {
  it("builds cumulative points and safe percentage changes", () => {
    expect(
      buildCumulativePoints(
        [
          { date: "2026-08-01", value: 2 },
          { date: "2026-08-02", value: 3 },
        ],
        10,
      ),
    ).toEqual([
      { date: "2026-08-01", value: 12 },
      { date: "2026-08-02", value: 15 },
    ]);
    expect(percentageChange(150, 100)).toBe(50);
    expect(percentageChange(10, 0)).toBeNull();
  });

  it("selects the previous non-overlapping publish cohort", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const rows = [
      post({ id: "current", published_at: "2026-08-08T12:00:00.000Z" }),
      post({ id: "previous", published_at: "2026-08-01T12:00:00.000Z" }),
      post({ id: "old", published_at: "2026-07-20T12:00:00.000Z" }),
    ];
    expect(filterPostsByPreviousRange(rows, "7", now).map((row) => row.id)).toEqual([
      "previous",
    ]);
  });

  it("builds evidence-labelled topic audits", () => {
    const audits = buildDashboardTopicAudits([
      post({ id: "a", topic: "AI", views: 300, title: "AI hook" }),
      post({ id: "b", topic: "AI", views: 200 }),
      post({ id: "c", topic: "Career", views: 100 }),
    ]);
    expect(audits[0]?.topic).toBe("AI");
    expect(audits[0]?.multiplier).toBeCloseTo(1.25);
    expect(audits[0]?.confidence).toBe("low");
    expect(audits[0]?.supportingPosts).toHaveLength(2);
  });

  it("fills missing account-insight days with zero", () => {
    const points = buildAccountFollowerSeries({
      insights: [
        {
          capturedAt: "2026-08-10T12:00:00.000Z",
          rangeStart: "2026-08-01T00:00:00.000Z",
          rangeEnd: "2026-08-10T00:00:00.000Z",
          totals: {
            views: null,
            reach: null,
            profileViews: null,
            accountsEngaged: null,
            totalInteractions: null,
            likes: null,
            comments: null,
            shares: null,
            saves: null,
            replies: null,
            profileLinksTaps: null,
            follows: null,
            unfollows: null,
          },
          daily: [{ date: "2026-08-10", reach: 1, followerCount: 4 }],
          audience: { gender: [], age: [], country: [], city: [] },
        },
      ],
      days: 2,
      now: new Date("2026-08-10T12:00:00.000Z"),
    });
    expect(points).toEqual([
      { date: "2026-08-09", value: 0 },
      { date: "2026-08-10", value: 4 },
    ]);
  });
});
