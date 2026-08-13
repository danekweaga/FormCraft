import { describe, expect, it } from "vitest";
import type { SearchPostResult } from "./discovery/types";
import {
  attachTrackedCreatorIdentity,
  orderWatchlistCreators,
} from "./watchlist-monitor";

function creator(id: string, freshness: string | null) {
  return {
    id,
    platform: "tiktok",
    platform_creator_id: id,
    handle: id,
    display_name: id,
    tracking_paused: false,
    data_freshness_at: freshness,
  };
}

describe("watchlist priority", () => {
  it("checks daily-priority creators before the stale rotation", () => {
    const ordered = orderWatchlistCreators(
      [
        creator("stale", null),
        creator("priority", "2026-08-13T00:00:00.000Z"),
        creator("older", "2026-08-10T00:00:00.000Z"),
      ],
      new Map([["priority", 100]]),
    );

    expect(ordered.map((item) => item.id)).toEqual([
      "priority",
      "stale",
      "older",
    ]);
  });

  it("keeps the imported creator identity on provider posts", () => {
    const post: SearchPostResult = {
      platform: "tiktok",
      externalId: "video-1",
      externalUrl: "https://www.tiktok.com/@20vc_tok/video/1",
      creatorId: "provider-numeric-id",
      creatorName: "Provider name",
      title: "AI company news",
      description: null,
      thumbnailUrl: null,
      publishedAt: "2026-08-13T00:00:00.000Z",
      durationSeconds: 20,
      views: 100_000,
      likes: 2_000,
      comments: 40,
      shares: null,
      providerName: "scrapecreators",
      collectionMethod: "third_party_creator_posts",
      retrievedAt: "2026-08-13T01:00:00.000Z",
    };

    const [attached] = attachTrackedCreatorIdentity([post], {
      platform_creator_id: "20vc_tok",
      display_name: "20vc_tok",
      handle: "20vc_tok",
    });
    expect(attached.creatorId).toBe("20vc_tok");
    expect(attached.creatorName).toBe("20vc_tok");
  });
});
