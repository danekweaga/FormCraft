import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeTiktokVideo,
  tiktokDataDiscoveryProvider,
} from "./tiktok-data-provider";

describe("normalizeTiktokVideo", () => {
  it("maps a typical third-party video payload", () => {
    const post = normalizeTiktokVideo(
      {
        id: "712345",
        desc: "CS student tip",
        create_time: 1_720_000_000,
        cover: "https://example.com/cover.jpg",
        author: {
          unique_id: "demo_cs",
          nickname: "Demo CS",
          follower_count: 12_000,
        },
        stats: {
          play_count: 50_000,
          digg_count: 2_000,
          comment_count: 120,
          share_count: 40,
        },
      },
      "2026-08-10T12:00:00.000Z",
    );

    expect(post).toMatchObject({
      platform: "tiktok",
      externalId: "712345",
      creatorId: "demo_cs",
      views: 50_000,
      likes: 2_000,
      providerName: "tiktokapi_store",
    });
    expect(post?.externalUrl).toContain("712345");
  });

  it("returns null without an id", () => {
    expect(
      normalizeTiktokVideo(
        { desc: "no id" },
        "2026-08-10T12:00:00.000Z",
      ),
    ).toBeNull();
  });
});

describe("tiktokDataDiscoveryProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the documented search_term parameter and bearer authorization", async () => {
    vi.stubEnv("TIKTOK_DATA_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            videos: [
              {
                id: "7412345678901234567",
                desc: "A current TikTok result",
                author: { unique_id: "creator" },
                stats: { play_count: 1200 },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await tiktokDataDiscoveryProvider.searchPosts!({
      query: "coding",
      platforms: ["tiktok"],
      lookbackDays: 30,
      maxResults: 10,
      minViews: 0,
    });

    const [requestUrl, init] = fetchMock.mock.calls[0]!;
    const url = new URL(String(requestUrl));
    expect(url.pathname).toBe("/api/v1/search/video");
    expect(url.searchParams.get("search_term")).toBe("coding");
    expect(url.searchParams.has("keyword")).toBe(false);
    expect(init?.headers).toEqual({ Authorization: "Bearer test-key" });
    expect(results).toHaveLength(1);
  });

  it("falls back to the documented feed endpoint", async () => {
    vi.stubEnv("TIKTOK_DATA_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "search unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { videos: [] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await tiktokDataDiscoveryProvider.searchPosts!({
      query: "coding",
      platforms: ["tiktok"],
      lookbackDays: 30,
      maxResults: 10,
      minViews: 0,
    });

    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).pathname).toBe(
      "/api/v1/feed",
    );
  });
});
