import { describe, expect, it } from "vitest";
import {
  buildCreatorRecommendationQuery,
  creatorSignalTokens,
  scoreSimilarCreators,
  type CreatorSuggestionPost,
} from "./creator-suggestions";

const seedPosts: CreatorSuggestionPost[] = [
  {
    creatorId: "seed-1",
    title: "Computer science internships and portfolio projects",
    description: "Build real software projects as a CS student",
    topic: "student developer careers",
    outlierScore: 2,
    views: 10_000,
  },
];

describe("creator suggestions", () => {
  it("normalizes useful creator signals", () => {
    expect(creatorSignalTokens("The best AI tools for CS students")).toEqual([
      "tools",
      "students",
    ]);
  });

  it("builds a focused provider query from watchlist evidence", () => {
    const query = buildCreatorRecommendationQuery({
      niche: "computer science students",
      topics: ["AI tools", "internships"],
      keywords: ["portfolio"],
      seedPosts,
    });
    expect(query).toContain("computer science students");
    expect(query).toMatch(/internships|portfolio|tools/);
    expect(query.length).toBeLessThanOrEqual(160);
  });

  it("ranks candidates with shared topics and outlier evidence", () => {
    const scored = scoreSimilarCreators({
      seedCreatorIds: ["seed-1"],
      seedPlatforms: ["youtube"],
      seedPosts,
      nicheSignals: ["computer science students", "portfolio", "internships"],
      candidates: [
        {
          id: "strong",
          platform: "youtube",
          handle: "strong",
          displayName: "Strong",
          followerCount: 50_000,
        },
        {
          id: "weak",
          platform: "tiktok",
          handle: "weak",
          displayName: "Weak",
          followerCount: 50_000,
        },
      ],
      candidatePosts: [
        {
          creatorId: "strong",
          title: "How CS students get internships with portfolio projects",
          description: "A student developer career guide",
          topic: "computer science internships",
          outlierScore: 4.2,
          views: 80_000,
        },
        {
          creatorId: "weak",
          title: "A day at the beach",
          description: "Travel vlog",
          topic: "travel",
          outlierScore: 8,
          views: 500_000,
        },
      ],
      excludedCreatorIds: [],
    });
    expect(scored).toHaveLength(1);
    expect(scored[0]?.externalCreatorId).toBe("strong");
    expect(scored[0]?.evidence.outlierPostCount).toBe(1);
    expect(scored[0]?.matchedTopics).toContain("internships");
  });

  it("never recommends an account already watched or dismissed", () => {
    const scored = scoreSimilarCreators({
      seedCreatorIds: ["seed-1"],
      seedPlatforms: ["youtube"],
      seedPosts,
      nicheSignals: ["computer science"],
      candidates: [
        {
          id: "excluded",
          platform: "youtube",
          handle: "excluded",
          displayName: "Excluded",
          followerCount: null,
        },
      ],
      candidatePosts: [
        {
          creatorId: "excluded",
          title: "Computer science portfolio",
          description: null,
          topic: "computer science",
          outlierScore: 2,
          views: 10_000,
        },
      ],
      excludedCreatorIds: ["excluded"],
    });
    expect(scored).toEqual([]);
  });
});
