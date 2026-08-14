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

  it("normalizes numeric-string dates and nested Instagram cover candidates", () => {
    const post = normalizeInstagramReel(
      {
        media: {
          code: "PROFILE2",
          taken_at: "1786464000",
          play_count: 42_000,
          image_versions2: {
            candidates: [
              {
                url: "https://instagram.example.fbcdn.net/cover.jpg",
                width: 1080,
                height: 1920,
              },
            ],
          },
          user: { username: "creator" },
        },
      },
      "2026-08-12T12:00:00.000Z",
    );

    expect(post?.publishedAt).toBe("2026-08-11T16:00:00.000Z");
    expect(post?.thumbnailUrl).toBe(
      "https://instagram.example.fbcdn.net/cover.jpg",
    );
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

  it("widens Instagram search pages when the first window is sparse", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "test-sc-key");
    vi.stubEnv("YOUTUBE_DATA_API_KEY", "yt-key");
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get("page") ?? "1");
      const datePosted = url.searchParams.get("date_posted");
      const shortcode = `${datePosted ?? "open"}-p${page}`;
      return new Response(
        JSON.stringify({
          credits_remaining: 7000,
          credits_charged: 1,
          reels: [
            {
              shortcode,
              caption: "reel",
              video_play_count: 90_000,
              owner: { username: "iguser" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await scrapeCreatorsDiscoveryProvider.searchPosts({
      query: "coding",
      platforms: ["instagram"],
      lookbackDays: 30,
      maxResults: 8,
    });

    const dates = fetchMock.mock.calls.map(
      ([input]) => new URL(String(input)).searchParams.get("date_posted"),
    );
    expect(dates).toContain("last-month");
    expect(dates).toContain("last-year");
    expect(results.length).toBeGreaterThan(1);
  });

  it("does not widen Instagram to last-year on an incremental lookback", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "test-sc-key");
    const fetchMock = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          credits_remaining: 7000,
          credits_charged: 1,
          reels: [
            {
              shortcode: "fresh-ig",
              caption: "reel",
              video_play_count: 90_000,
              owner: { username: "iguser" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await scrapeCreatorsDiscoveryProvider.searchPosts({
      query: "coding",
      platforms: ["instagram"],
      lookbackDays: 1,
      maxResults: 8,
    });

    const dates = fetchMock.mock.calls.map(
      ([input]) => new URL(String(input)).searchParams.get("date_posted"),
    );
    expect(dates.every((date) => date === "last-day")).toBe(true);
    expect(dates).not.toContain("last-year");
  });

  it("paginates a TikTok creator until the requested 30-day feed is covered", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "test-sc-key");
    const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo) => {
      const url = new URL(String(input));
      const secondPage = url.searchParams.get("max_cursor") === "page-2";
      return new Response(
        JSON.stringify({
          credits_remaining: secondPage ? 98 : 99,
          credits_charged: 1,
          aweme_list: [
            {
              aweme_id: secondPage ? "tt-2" : "tt-1",
              desc: "AI founder lesson",
              create_time_utc: recent,
              author: { unique_id: "founder", nickname: "Founder" },
              statistics: { play_count: secondPage ? 80_000 : 40_000 },
            },
          ],
          has_more: secondPage ? 0 : 1,
          max_cursor: secondPage ? null : "page-2",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await scrapeCreatorsDiscoveryProvider.getCreatorPosts!({
      platform: "tiktok",
      platformCreatorId: "founder",
      maxResults: 200,
      maxPages: 5,
      lookbackDays: 30,
    });

    expect(results.map((post) => post.externalId)).toEqual(["tt-1", "tt-2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("paginates Instagram reels with max_id", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "test-sc-key");
    const recentSeconds = Math.floor((Date.now() - 2 * 86_400_000) / 1000);
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo) => {
      const url = new URL(String(input));
      const secondPage = url.searchParams.get("max_id") === "page-2";
      return new Response(
        JSON.stringify({
          credits_remaining: secondPage ? 98 : 99,
          credits_charged: 1,
          items: [
            {
              media: {
                code: secondPage ? "ig-2" : "ig-1",
                caption: { text: "A useful creator lesson" },
                play_count: secondPage ? 90_000 : 30_000,
                taken_at: recentSeconds,
                user: { username: "founder", full_name: "Founder" },
              },
            },
          ],
          paging_info: {
            more_available: !secondPage,
            max_id: secondPage ? null : "page-2",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await scrapeCreatorsDiscoveryProvider.getCreatorPosts!({
      platform: "instagram",
      platformCreatorId: "founder",
      maxResults: 200,
      maxPages: 5,
      lookbackDays: 30,
    });

    expect(results.map((post) => post.externalId)).toEqual(["ig-1", "ig-2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
