import { describe, expect, it } from "vitest";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import { buildDataQuality, buildMetricGroups, median, reportHook, reportTopic } from "./metrics";

function post(input: Partial<ContentPostRow> & { id: string }): ContentPostRow {
  const { id, ...rest } = input;
  return {
    id,
    platform: "instagram",
    source: "manual_entry",
    source_label: "Test",
    title: null,
    caption: null,
    published_at: "2026-08-01T00:00:00.000Z",
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    followers_gained: null,
    is_winner: false,
    needs_review: false,
    relative_performance: {},
    created_at: "2026-08-01T00:00:00.000Z",
    ...rest,
  };
}

describe("report metrics", () => {
  it("uses medians so one viral post does not distort the baseline", () => {
    expect(median([100, 110, 10_000])).toBe(110);
  });

  it("keeps supporting and contradictory post evidence", () => {
    const posts = [
      post({ id: "a", topic: "AI", views: 300, comments: 30, shares: 10 }),
      post({ id: "b", topic: "AI", views: 50, comments: 2, shares: 1 }),
      post({ id: "c", topic: "Career", views: 100, comments: 5, shares: 2 }),
    ];
    const ai = buildMetricGroups(posts, reportTopic).find((group) => group.label === "AI");
    expect(ai?.sampleSize).toBe(2);
    expect(ai?.supportingPostIds).toContain("a");
    expect(ai?.contradictoryPostIds).toContain("b");
  });

  it("labels insufficient and missing evidence honestly", () => {
    const rows = [post({ id: "a", caption: "Stop making this mistake", views: 100 })];
    expect(reportHook(rows[0]!)).toBe("Warning");
    const quality = buildDataQuality(rows, 0);
    expect(quality.confidence).toBe("low");
    expect(quality.warnings.some((warning) => warning.includes("fewer than five") || warning.includes("Fewer than five"))).toBe(true);
    expect(quality.warnings).toContain("No audience comments are linked to these posts.");
  });
});
