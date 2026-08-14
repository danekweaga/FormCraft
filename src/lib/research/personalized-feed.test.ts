import { describe, expect, it } from "vitest";
import {
  mixFeedByPolicy,
  rankPersonalizedFeed,
  type PersonalizedFeedCandidate,
} from "./personalized-feed";

const NOW = new Date("2026-08-13T12:00:00.000Z");

function candidate(
  id: string,
  overrides: Partial<PersonalizedFeedCandidate> = {},
): PersonalizedFeedCandidate {
  return {
    id,
    platform: "instagram",
    external_creator_id: `creator-${id}`,
    creator_name: `Creator ${id}`,
    title: "AI advice for computer science students",
    description: null,
    topic: "AI for CS students",
    views: 30_000,
    outlier_score: 1.2,
    published_at: "2026-08-10T12:00:00.000Z",
    saved: false,
    analysis_model: null,
    personalScore: 20,
    whyRelevant: [],
    ...overrides,
  };
}

describe("rankPersonalizedFeed", () => {
  it("puts personal fit ahead of raw viral views", () => {
    const result = rankPersonalizedFeed(
      [
        candidate("viral", { views: 9_000_000, personalScore: 3 }),
        candidate("fit", { views: 45_000, personalScore: 55 }),
      ],
      { now: NOW },
    );

    expect(result[0].id).toBe("fit");
  });

  it("learns from relevant feedback and propagates creator affinity", () => {
    const result = rankPersonalizedFeed(
      [
        candidate("liked", { external_creator_id: "creator-a" }),
        candidate("same-creator", {
          external_creator_id: "creator-a",
          personalScore: 10,
        }),
        candidate("other", { personalScore: 11 }),
      ],
      {
        now: NOW,
        feedback: [
          {
            research_item_id: "liked",
            feedback_type: "relevant",
            created_at: "2026-08-13T10:00:00.000Z",
          },
        ],
      },
    );

    const sameCreator = result.find((item) => item.id === "same-creator");
    const other = result.find((item) => item.id === "other");
    expect(sameCreator!.recommendationScore).toBeGreaterThan(
      other!.recommendationScore,
    );
    expect(sameCreator!.whyRelevant.join(" ")).toContain("Similar to creators");
  });

  it("removes videos after the latest not-relevant signal", () => {
    const result = rankPersonalizedFeed(
      [candidate("skip"), candidate("keep")],
      {
        now: NOW,
        feedback: [
          {
            research_item_id: "skip",
            feedback_type: "not_relevant",
            created_at: "2026-08-13T11:00:00.000Z",
          },
          {
            research_item_id: "skip",
            feedback_type: "relevant",
            created_at: "2026-08-12T11:00:00.000Z",
          },
        ],
      },
    );

    expect(result.map((item) => item.id)).toEqual(["keep"]);
  });

  it("keeps For You inside the configured rolling window", () => {
    const result = rankPersonalizedFeed(
      [
        candidate("recent"),
        candidate("old", { published_at: "2026-06-01T12:00:00.000Z" }),
      ],
      { now: NOW, maxAgeDays: 30 },
    );

    expect(result.map((item) => item.id)).toEqual(["recent"]);
  });

  it("uses winning owned topics as a strong recommendation signal", () => {
    const result = rankPersonalizedFeed(
      [
        candidate("winner-match", {
          title: "How I prepared for a software engineering internship",
          topic: "internships",
          personalScore: 15,
        }),
        candidate("generic", {
          title: "A generic productivity tip",
          topic: "productivity",
          personalScore: 18,
        }),
      ],
      { now: NOW, highPerformingTopics: ["software engineering internships"] },
    );

    expect(result[0].id).toBe("winner-match");
    expect(result[0].whyRelevant.join(" ")).toContain("performed for you");
  });

  it("diversifies creators when scores are close", () => {
    const result = rankPersonalizedFeed(
      [
        candidate("a1", {
          external_creator_id: "creator-a",
          personalScore: 50,
        }),
        candidate("a2", {
          external_creator_id: "creator-a",
          personalScore: 49,
        }),
        candidate("b1", {
          external_creator_id: "creator-b",
          personalScore: 44,
        }),
      ],
      { now: NOW },
    );

    expect(result.slice(0, 2).map((item) => item.id)).toEqual(["a1", "b1"]);
  });

  it("promotes recommended creators ahead of the watchlist", () => {
    const result = rankPersonalizedFeed(
      [
        candidate("suggested", {
          external_creator_id: "creator-suggested",
          personalScore: 20,
        }),
        candidate("tracked", {
          external_creator_id: "creator-watched",
          personalScore: 40,
        }),
      ],
      {
        now: NOW,
        suggestedCreatorIds: ["creator-suggested"],
        watchedCreatorIds: ["creator-watched"],
      },
    );

    expect(result[0].id).toBe("suggested");
    expect(result[0].whyRelevant.join(" ")).toContain("recommended");
  });

  it("surfaces new niche creators ahead of tracked ones when quality is similar", () => {
    const result = rankPersonalizedFeed(
      [
        candidate("tracked", {
          external_creator_id: "creator-watched",
          personalScore: 22,
        }),
        candidate("discovery", {
          external_creator_id: "creator-new",
          personalScore: 22,
        }),
      ],
      { now: NOW, watchedCreatorIds: ["creator-watched"] },
    );

    expect(result[0].id).toBe("discovery");
    expect(result[0].whyRelevant.join(" ")).toContain("New creator");
  });

  it("mixes search hits ahead of a watchlist-heavy pool", () => {
    const pool = [
      ...Array.from({ length: 8 }, (_, index) =>
        candidate(`w${index}`, {
          external_creator_id: "creator-watched",
          collection_method: "third_party_creator_posts",
          personalScore: 40,
        }),
      ),
      candidate("d1", {
        external_creator_id: "creator-new-a",
        collection_method: "third_party_search",
        personalScore: 18,
      }),
      candidate("d2", {
        external_creator_id: "creator-new-b",
        collection_method: "third_party_search",
        personalScore: 18,
      }),
      candidate("d3", {
        external_creator_id: "creator-new-c",
        collection_method: "third_party_search",
        personalScore: 18,
      }),
    ];
    const ranked = rankPersonalizedFeed(pool, {
      now: NOW,
      watchedCreatorIds: ["creator-watched"],
    });
    const mixed = mixFeedByPolicy(ranked, {
      watchedCreatorIds: ["creator-watched"],
      targetLength: 10,
    });
    const discoveryCount = mixed.filter((item) =>
      item.id.startsWith("d"),
    ).length;
    expect(discoveryCount).toBeGreaterThanOrEqual(3);
    expect(mixed.slice(0, 10).every((item) => item.id.startsWith("w"))).toBe(
      false,
    );
  });
});
