import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESEARCH_FILTERS,
  filterResearchItems,
} from "./feed-filters";

const now = new Date("2026-08-10T12:00:00.000Z");

function item(overrides: Record<string, unknown> = {}) {
  return {
    title: "AI for CS students",
    description: "internship tips",
    creator_name: "Demo CS",
    platform: "youtube",
    views: 10_000,
    likes: 500,
    comments: 50,
    shares: 10,
    outlier_score: 3.2,
    published_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("filterResearchItems", () => {
  it("filters by keywords and platform", () => {
    const result = filterResearchItems(
      [
        item(),
        item({ title: "Cooking pasta", platform: "tiktok", outlier_score: 5 }),
      ],
      { ...DEFAULT_RESEARCH_FILTERS, keywords: "cs students", platform: "youtube" },
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toContain("AI");
  });

  it("filters by outlier and engagement", () => {
    const result = filterResearchItems(
      [
        item({ outlier_score: 1.1, likes: 10, comments: 0, shares: 0 }),
        item({ outlier_score: 4, likes: 800, comments: 100, shares: 20 }),
      ],
      {
        ...DEFAULT_RESEARCH_FILTERS,
        minOutlier: 2,
        minEngagement: 5,
      },
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.outlier_score).toBe(4);
  });
});
