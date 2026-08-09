import { describe, expect, it } from "vitest";
import { getInstagramAccountInsights } from "./instagram-account-insights";

describe("Instagram account insights metadata", () => {
  it("accepts a complete stored snapshot and rejects partial data", () => {
    const insights = {
      capturedAt: "2026-08-09T12:00:00.000Z",
      rangeStart: "2026-07-11T12:00:00.000Z",
      rangeEnd: "2026-08-09T12:00:00.000Z",
      totals: {
        views: 100,
        reach: 80,
        profileViews: 10,
        accountsEngaged: 12,
        totalInteractions: 15,
        likes: 8,
        comments: 2,
        shares: 3,
        saves: 2,
        replies: 0,
        profileLinksTaps: 1,
        follows: 4,
        unfollows: 1,
      },
      daily: [{ date: "2026-08-09", reach: 8, followerCount: 50 }],
      audience: { gender: [], age: [], country: [], city: [] },
    };

    expect(getInstagramAccountInsights({ accountInsights: insights })?.totals.views)
      .toBe(100);
    expect(getInstagramAccountInsights({ accountInsights: { totals: {} } }))
      .toBeNull();
  });
});

