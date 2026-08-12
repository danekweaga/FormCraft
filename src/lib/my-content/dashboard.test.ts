import { describe, expect, it } from "vitest";
import { buildTopicPerformance } from "./dashboard";
import type { ContentPostRow } from "./schemas";

function post(
  id: string,
  topic: string | null,
  views: number,
): ContentPostRow {
  return {
    id,
    platform: "instagram",
    source: "instagram_sync",
    source_label: "Instagram",
    title: null,
    caption: null,
    topic,
    published_at: "2026-08-10T00:00:00.000Z",
    views,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    followers_gained: 0,
    is_winner: false,
    needs_review: false,
    relative_performance: {},
    created_at: "2026-08-10T00:00:00.000Z",
  };
}

describe("performance topic groups", () => {
  it("does not let an unclassified bucket hide useful classified topics", () => {
    const result = buildTopicPerformance([
      post("a", null, 10_000),
      post("b", "AI-assisted coding", 2_000),
      post("c", "Tutorial dependency & self-learning", 1_500),
    ]);
    expect(result.map((entry) => entry.topic)).toEqual([
      "AI-assisted coding",
      "Tutorial dependency & self-learning",
    ]);
  });

  it("keeps Unclassified when no usable classification exists", () => {
    expect(buildTopicPerformance([post("a", null, 100)])[0]?.topic).toBe(
      "Unclassified",
    );
  });
});

