import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeTiktokDurationSeconds,
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

  it("maps mint-style payloads with top-level play_count and aweme_id", () => {
    const post = normalizeTiktokVideo(
      {
        aweme_id: "7636532436318407949",
        title: "good eatin",
        play_count: 17_277,
        create_time: Math.floor(Date.now() / 1000) - 86_400,
        author: { unique_id: "chef", nickname: "Chef" },
      },
      new Date().toISOString(),
    );
    expect(post?.externalId).toBe("7636532436318407949");
    expect(post?.views).toBe(17_277);
  });
});

describe("tiktokDataDiscoveryProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the documented search endpoint and parameters", async () => {
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
    expect(url.hostname).toBe("tiktokapi.store");
    expect(url.pathname).toBe("/api/v1/search/video");
    expect(url.searchParams.get("search_term")).toBe("coding");
    expect(init?.headers).toEqual({ Authorization: "Bearer test-key" });
    expect(results).toHaveLength(1);
  });

  it("falls back to the feed when search fails", async () => {
    vi.stubEnv("TIKTOK_DATA_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/feed")) {
        return new Response(
          JSON.stringify({
            data: {
              videos: [
                {
                  id: "trend1",
                  desc: "trending",
                  author: { unique_id: "t" },
                  stats: { play_count: 5000 },
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ message: "search unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await tiktokDataDiscoveryProvider.searchPosts!({
      query: "coding",
      platforms: ["tiktok"],
      lookbackDays: 30,
      maxResults: 10,
      minViews: 0,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.externalId).toBe("trend1");
  });

  it("continues fallbacks when an endpoint returns empty 200", async () => {
    vi.stubEnv("TIKTOK_DATA_API_KEY", "test-key");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/feed")) {
        return new Response(
          JSON.stringify({
            data: {
              videos: [
                {
                  id: "from-trend",
                  desc: "ok",
                  author: { unique_id: "u" },
                  stats: { play_count: 900 },
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ data: { videos: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await tiktokDataDiscoveryProvider.searchPosts!({
      query: "coding",
      platforms: ["tiktok"],
      lookbackDays: 30,
      maxResults: 10,
      minViews: 0,
    });

    expect(results.map((r) => r.externalId)).toEqual(["from-trend"]);
  });

  it("skips old keyword hits and uses trending instead", async () => {
    vi.stubEnv("TIKTOK_DATA_API_KEY", "test-key");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const oldCreate = Math.floor(Date.now() / 1000) - 200 * 86_400;
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/feed")) {
        return new Response(
          JSON.stringify({
            data: {
              videos: [
                {
                  id: "fresh-tt",
                  desc: "today",
                  create_time: Math.floor(Date.now() / 1000) - 86_400,
                  author: { unique_id: "u" },
                  stats: { play_count: 900 },
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          data: {
            videos: [
              {
                id: "old-viral",
                desc: "old hit",
                create_time: oldCreate,
                author: { unique_id: "v" },
                stats: { play_count: 5_000_000 },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await tiktokDataDiscoveryProvider.searchPosts!({
      query: "coding",
      platforms: ["tiktok"],
      lookbackDays: 30,
      maxResults: 10,
      minViews: 0,
    });

    expect(results.map((r) => r.externalId)).toEqual(["fresh-tt"]);
  });

  it("normalizes millisecond durations", () => {
    expect(normalizeTiktokDurationSeconds(15200)).toBe(15);
    expect(normalizeTiktokDurationSeconds(42)).toBe(42);
  });
});
