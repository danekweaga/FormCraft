import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMetaInstagramDiscoveryStatus,
  metaInstagramDiscoveryProvider,
  normalizeInstagramUsername,
} from "./meta-instagram-provider";

describe("Meta Instagram Business Discovery", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes handles and Instagram profile URLs safely", () => {
    expect(normalizeInstagramUsername("@mkbhd")).toBe("mkbhd");
    expect(normalizeInstagramUsername("https://instagram.com/mkbhd/")).toBe(
      "mkbhd",
    );
    expect(normalizeInstagramUsername("https://evil.example/mkbhd")).toBeNull();
    expect(normalizeInstagramUsername("bad){media{id}}")).toBeNull();
  });

  it("pulls only Reels and keeps the token out of the request URL", async () => {
    vi.stubEnv("META_BUSINESS_DISCOVERY_ACCESS_TOKEN", "server-secret-token");
    vi.stubEnv("META_BUSINESS_DISCOVERY_IG_USER_ID", "17841439075121762");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          business_discovery: {
            id: "17841400463380452",
            username: "mkbhd",
            name: "Marques Brownlee",
            followers_count: 5_193_372,
            media: {
              data: [
                {
                  id: "reel-1",
                  caption: "Keep zooming",
                  media_type: "VIDEO",
                  media_product_type: "REELS",
                  permalink: "https://www.instagram.com/reel/DbB0UmmPcPL/",
                  timestamp: "2026-08-10T20:40:20+0000",
                  like_count: 102_183,
                  comments_count: 698,
                  thumbnail_url: "https://cdn.example/thumb.jpg",
                },
                {
                  id: "image-1",
                  media_type: "IMAGE",
                  media_product_type: "FEED",
                  permalink: "https://www.instagram.com/p/image-1/",
                },
              ],
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const posts = await metaInstagramDiscoveryProvider.getCreatorPosts!({
      platform: "instagram",
      platformCreatorId: "@mkbhd",
      maxResults: 10,
    });

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      creatorId: "mkbhd",
      views: null,
      likes: 102_183,
      comments: 698,
      providerName: "meta_instagram_business_discovery",
    });
    const [requestUrl, init] = fetchMock.mock.calls[0]!;
    expect(String(requestUrl)).not.toContain("server-secret-token");
    expect(init?.headers).toEqual({
      Authorization: "Bearer server-secret-token",
    });
  });

  it("reports the configured expiry without exposing the token", () => {
    vi.stubEnv("META_BUSINESS_DISCOVERY_ACCESS_TOKEN", "secret");
    vi.stubEnv("META_BUSINESS_DISCOVERY_IG_USER_ID", "17841439075121762");
    vi.stubEnv("META_BUSINESS_DISCOVERY_TOKEN_EXPIRES_AT", "2026-10-11");
    expect(
      getMetaInstagramDiscoveryStatus(
        new Date("2026-10-01T00:00:00.000Z").getTime(),
      ),
    ).toEqual({
      configured: true,
      expiresAt: "2026-10-11",
      expired: false,
      daysRemaining: 11,
    });
  });

  it("redacts the server token from Meta errors", async () => {
    vi.stubEnv("META_BUSINESS_DISCOVERY_ACCESS_TOKEN", "never-return-this");
    vi.stubEnv("META_BUSINESS_DISCOVERY_IG_USER_ID", "17841439075121762");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 190,
              message: "Invalid token never-return-this",
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      metaInstagramDiscoveryProvider.getCreatorPosts!({
        platform: "instagram",
        platformCreatorId: "mkbhd",
      }),
    ).rejects.toThrow("Invalid token [redacted]");
  });
});
