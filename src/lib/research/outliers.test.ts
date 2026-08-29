import { describe, expect, it } from "vitest";
import { classifyCheapRelevance } from "./cheap-relevance";
import {
  baselineConfidence,
  calculateVelocityLabel,
  outlierLabel,
  scoreResearchOutliers,
} from "./outliers";
import { providerBudgetAllows } from "./provider-budget";
import { scorePersonalRelevance } from "./relevance";
import { normalizeSearchFilters } from "./search-filters";
import type { ResearchVideoCandidate } from "./types";

function video(
  id: string,
  creatorId: string,
  views: number,
  daysAgo = 0,
): ResearchVideoCandidate {
  return {
    platform: "youtube",
    externalId: id,
    externalUrl: `https://youtube.test/${id}`,
    creatorId,
    creatorName: creatorId,
    title: id,
    description: null,
    thumbnailUrl: null,
    publishedAt: new Date(
      Date.UTC(2026, 7, 12) - daysAgo * 86_400_000,
    ).toISOString(),
    durationSeconds: null,
    views,
    likes: null,
    comments: null,
    shares: null,
  };
}

describe("scoreResearchOutliers", () => {
  it("uses up to 30 prior creator posts and excludes the scored post", () => {
    const scored = scoreResearchOutliers([
      video("hot", "creator", 900, 0),
      video("a", "creator", 100, 1),
      video("b", "creator", 200, 2),
      video("c", "creator", 200, 3),
      video("d", "creator", 300, 4),
      video("e", "creator", 200, 5),
      video("other", "other", 50, 6),
    ]);
    const outlier = scored.find((item) => item.externalId === "hot");
    expect(outlier?.scoreBasis).toBe("creator_median");
    expect(outlier?.baselineViews).toBe(200);
    expect(outlier?.outlierScore).toBe(4.5);
    expect(outlier?.outlierLabel).toBe("strong_outlier");
    expect(outlier?.baselineSampleSize).toBe(5);
    expect(outlier?.baselineConfidence).toBe("medium");
  });

  it("requires five prior creator posts before using a creator baseline", () => {
    const scored = scoreResearchOutliers([
      video("hot", "creator", 900, 0),
      video("a", "creator", 100, 1),
      video("b", "creator", 200, 2),
      video("c", "creator", 200, 3),
      video("d", "creator", 300, 4),
      video("other", "other", 50, 5),
    ]);
    expect(scored.find((item) => item.externalId === "hot")?.scoreBasis).toBe(
      "niche_cohort_median",
    );
  });

  it("falls back to the disclosed niche cohort median", () => {
    const scored = scoreResearchOutliers([
      video("a", "one", 100, 2),
      video("b", "two", 200, 1),
      video("c", "three", 900, 0),
    ]);
    const outlier = scored.find((item) => item.externalId === "c");
    expect(outlier?.scoreBasis).toBe("niche_cohort_median");
    expect(outlier?.outlierScore).toBe(6);
  });

  it("scores TikTok against TikTok, not YouTube medians", () => {
    const scored = scoreResearchOutliers([
      video("yt-a", "yt1", 100_000),
      video("yt-b", "yt2", 200_000),
      video("yt-c", "yt3", 300_000),
      {
        ...video("tt-hot", "tt1", 8_000),
        platform: "tiktok",
        externalUrl: "https://tiktok.test/tt-hot",
      },
      {
        ...video("tt-mid", "tt2", 1_000),
        platform: "tiktok",
        externalUrl: "https://tiktok.test/tt-mid",
      },
      {
        ...video("tt-low", "tt3", 1_000),
        platform: "tiktok",
        externalUrl: "https://tiktok.test/tt-low",
      },
    ]);
    const tiktokHot = scored.find((item) => item.externalId === "tt-hot");
    expect(tiktokHot?.outlierScore).toBe(8);
    expect(tiktokHot?.outlierLabel).toBe("exceptional");
  });
});

describe("baseline confidence and labels", () => {
  it("maps sample sizes", () => {
    expect(baselineConfidence(3)).toBe("low");
    expect(baselineConfidence(8)).toBe("medium");
    expect(baselineConfidence(20)).toBe("high");
  });

  it("labels multipliers", () => {
    expect(outlierLabel(0.5)).toBe("below_baseline");
    expect(outlierLabel(1.2)).toBe("typical");
    expect(outlierLabel(2)).toBe("emerging");
    expect(outlierLabel(3)).toBe("strong_outlier");
    expect(outlierLabel(6)).toBe("exceptional");
  });
});

describe("velocity", () => {
  it("detects accelerating growth", () => {
    expect(
      calculateVelocityLabel([
        { views: 1000, capturedAt: "2026-08-01T00:00:00.000Z" },
        { views: 2000, capturedAt: "2026-08-02T00:00:00.000Z" },
      ]),
    ).toBe("accelerating");
  });
});

describe("personal relevance", () => {
  it("boosts topic overlap and outlier strength", () => {
    const result = scorePersonalRelevance(
      {
        ...video("x", "c1", 900),
        outlierScore: 4.7,
        scoreBasis: "creator_median",
        baselineViews: 200,
        title: "AI is making CS students worse at interviews",
        topic: "AI for CS students",
      },
      {
        topics: ["AI for CS students"],
        lessons: ["Contrarian hooks work"],
        audienceSignals: ["AI dependency questions"],
        roadmapGoal: "Find a repeatable AI format",
        activeExperimentHypothesis: null,
        dismissedCreators: [],
      },
    );
    expect(result.score).toBeGreaterThan(40);
    expect(result.personalFit === "strong" || result.personalFit === "medium").toBe(
      true,
    );
  });
});

describe("provider budget", () => {
  it("blocks when daily budget exceeded", () => {
    const result = providerBudgetAllows({
      callsToday: 50,
      callsMonth: 10,
      budgets: {
        dailyCalls: 50,
        monthlyCalls: 500,
        maxResultsPerQuery: 25,
        autoDeepAnalysis: false,
      },
    });
    expect(result.ok).toBe(false);
  });

  it("does not classify official Meta discovery as a paid/quota provider", async () => {
    const {
      getDiscoveryBudgetsForPlatform,
      isDiscoveryProviderBudgeted,
    } = await import("./provider-budget");
    expect(isDiscoveryProviderBudgeted("meta_instagram_business_discovery")).toBe(
      false,
    );
    expect(isDiscoveryProviderBudgeted("scrapecreators")).toBe(true);
    expect(isDiscoveryProviderBudgeted("youtube_data_api")).toBe(false);
    expect(isDiscoveryProviderBudgeted("supadata")).toBe(false);
    const base = {
      dailyCalls: 50,
      monthlyCalls: 500,
      maxResultsPerQuery: 50,
      autoDeepAnalysis: false,
    };
    expect(getDiscoveryBudgetsForPlatform("instagram", base)).toMatchObject({
      dailyCalls: 35,
      monthlyCalls: 350,
    });
    expect(getDiscoveryBudgetsForPlatform("tiktok", base)).toMatchObject({
      dailyCalls: 15,
      monthlyCalls: 150,
    });
  });

  it("counts only attributed Instagram and TikTok usage", async () => {
    const { countDiscoveryUsageByPlatform } = await import("./provider-budget");
    const usage = countDiscoveryUsageByPlatform({
      dayStartIso: "2026-08-23T00:00:00.000Z",
      events: [
        {
          provider: "scrapecreators",
          metadata: { platform: "instagram" },
          created_at: "2026-08-23T01:00:00.000Z",
        },
        {
          provider: "tiktokapi_store",
          metadata: null,
          created_at: "2026-08-22T01:00:00.000Z",
        },
        {
          provider: "youtube_data_api",
          metadata: { platform: "youtube" },
          created_at: "2026-08-23T01:00:00.000Z",
        },
      ],
    });
    expect(usage).toEqual({
      instagram: { callsToday: 1, callsMonth: 1 },
      tiktok: { callsToday: 0, callsMonth: 1 },
    });
  });
});

describe("dedupe key", () => {
  it("treats same platform+id as duplicate", () => {
    const key = (p: string, id: string) => `${p}:${id}`;
    const seen = new Set<string>();
    const posts = [
      { platform: "youtube", externalId: "a" },
      { platform: "youtube", externalId: "a" },
      { platform: "youtube", externalId: "b" },
    ];
    const unique = posts.filter((post) => {
      const k = key(post.platform, post.externalId);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    expect(unique).toHaveLength(2);
  });
});

describe("normalizeSearchFilters", () => {
  it("clamps and drops unsupported platforms", () => {
    const normalized = normalizeSearchFilters({
      query: "  AI for CS students  ",
      platforms: ["youtube", "instagram", "myspace"],
      lookbackDays: 999,
      minViews: -5,
      minOutlierScore: 2,
      maxResults: 100,
      allowedPlatforms: ["youtube"],
    });
    expect(normalized.query).toBe("AI for CS students");
    expect(normalized.platforms).toEqual(["youtube"]);
    expect(normalized.lookbackDays).toBe(90);
    expect(normalized.minViews).toBe(20_000);
    expect(normalized.maxResults).toBe(50);
    expect(normalized.minOutlierScore).toBe(2);
  });
});

describe("cheap relevance", () => {
  it("flags lexical overlap", () => {
    const result = classifyCheapRelevance(
      {
        ...video("x", "c", 1000),
        title: "AI for CS students interview tips",
        outlierScore: 2,
        scoreBasis: "creator_median",
        baselineViews: 500,
      },
      "AI for CS students",
    );
    expect(result.relevant).toBe(true);
  });
});
