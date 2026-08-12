import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeInstagramReel,
  normalizeYoutubeSearchItem,
  scrapeCreatorsDiscoveryProvider,
} from "./scrapecreators-provider";

describe("normalizeInstagramReel", () => {
  it("maps a ScrapeCreators reels search item", () => {
    const post = normalizeInstagramReel(
      {
        id: "3723045213787686915",
        shortcode: "DOq6eV6iIgD",
        url: "https://www.instagram.com/reel/DOq6eV6iIgD/",
        caption: "Dogs are family",
        thumbnail_src: "https://example.com/thumb.jpg",
        video_play_count: 46018,
        like_count: 3487,
        comment_count: 90,
        video_duration: 75.7,
        taken_at: "2025-09-16T16:56:45.000Z",
        owner: {
          id: "70127159370",
          username: "fetchmycamera_",
          full_name: "Mark",
          follower_count: 188406,
        },
      },
      "2026-08-12T12:00:00.000Z",
    );

    expect(post).toMatchObject({
      platform: "instagram",
      externalId: "DOq6eV6iIgD",
      creatorName: "Mark",
      views: 46018,
      likes: 3487,
      providerName: "scrapecreators",
    });
    expect(post?.externalUrl).toContain("DOq6eV6iIgD");
  });

  it("unwraps profile-reels items that place the reel under media", () => {
    const post = normalizeInstagramReel(
      {
        media: {
          code: "PROFILE1",
          caption: { text: "A spoken hook" },
          play_count: 3210,
          like_count: 144,
          taken_at: 1_753_000_000,
          user: {
            pk: "creator-1",
            username: "creator",
            full_name: "Creator Name",
          },
        },
      },
      "2026-08-12T12:00:00.000Z",
    );

    expect(post).toMatchObject({
      platform: "instagram",
      externalId: "PROFILE1",
      creatorId: "creator-1",
      creatorName: "Creator Name",
      title: "A spoken hook",
      views: 3210,
    });
  });
});

describe("normalizeYoutubeSearchItem", () => {
  it("maps a shorts search hit", () => {
    const post = normalizeYoutubeSearchItem(
      {
        type: "short",
        id: "uMNvF-lSCHg",
        url: "https://www.youtube.com/watch?v=uMNvF-lSCHg",
        title: "LONG RUN ROUTINE",
        thumbnail: "https://example.com/t.jpg",
        channel: { id: "UCGRdc", title: "Abby and Ryan", handle: "abbyandryan" },
        viewCountInt: 462705,
        publishedTime: "2024-07-28T17:08:46.498Z",
        lengthSeconds: 44,
      },
      "2026-08-12T12:00:00.000Z",
    );
    expect(post).toMatchObject({
      platform: "youtube",
      externalId: "uMNvF-lSCHg",
      views: 462705,
      providerName: "scrapecreators",
    });
  });
});

describe("scrapeCreatorsDiscoveryProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("searches TikTok and Instagram in parallel and skips official YouTube", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "test-sc-key");
    vi.stubEnv("YOUTUBE_DATA_API_KEY", "yt-key");
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo) => {
      const url = new URL(String(input));
      if (url.pathname.includes("/tiktok/search/keyword")) {
        return new Response(
          JSON.stringify({
            credits_remaining: 7098,
            credits_charged: 1,
            search_item_list: [
              {
                aweme_id: "tt1",
                desc: "coding tip",
                create_time_utc: new Date().toISOString(),
                author: { unique_id: "dev", nickname: "Dev" },
                statistics: { play_count: 1200 },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.pathname.includes("/instagram/reels/search")) {
        return new Response(
          JSON.stringify({
            credits_remaining: 7097,
            credits_charged: 1,
            reels: [
              {
                shortcode: "ig1",
                caption: "reel",
                video_play_count: 900,
                owner: { username: "iguser" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`unexpected ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await scrapeCreatorsDiscoveryProvider.searchPosts({
      query: "coding career",
      platforms: ["youtube", "tiktok", "instagram"],
      lookbackDays: 30,
      maxResults: 10,
    });

    const paths = fetchMock.mock.calls.map(
      ([input]) => new URL(String(input)).pathname,
    );
    expect(paths).toContain("/v1/tiktok/search/keyword");
    expect(paths).toContain("/v2/instagram/reels/search");
    expect(paths.some((p) => p.includes("youtube"))).toBe(false);
    expect(results.map((r) => r.platform).sort()).toEqual([
      "instagram",
      "tiktok",
    ]);
  });
});
