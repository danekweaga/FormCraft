import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESEARCH_FILTERS,
  filterResearchItems,
  normalizeResearchFeedFilters,
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

  it("restores every persisted saved-filter value", () => {
    expect(
      normalizeResearchFeedFilters({
        keywords: "student projects",
        minOutlier: 2.5,
        maxOutlier: 12,
        minViews: 5000,
        maxViews: 250000,
        minEngagement: 3,
        maxEngagement: 20,
        postedWithinValue: 30,
        postedWithinUnit: "days",
        platform: "tiktok",
        creator: "Demo CS",
      }),
    ).toEqual({
      keywords: "student projects",
      minOutlier: 2.5,
      maxOutlier: 12,
      minViews: 5000,
      maxViews: 250000,
      minEngagement: 3,
      maxEngagement: 20,
      postedWithinValue: 30,
      postedWithinUnit: "days",
      platform: "tiktok",
      creator: "Demo CS",
    });
  });

  it("excludes videos with unknown publish dates from a time-bounded filter", () => {
    expect(
      filterResearchItems(
        [item({ published_at: null })],
        DEFAULT_RESEARCH_FILTERS,
        now,
      ),
    ).toHaveLength(0);
  });
});
