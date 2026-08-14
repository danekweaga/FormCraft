import { afterEach, describe, expect, it, vi } from "vitest";
import { cacheResearchThumbnail } from "./thumbnail-cache";

describe("cacheResearchThumbnail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("replaces TikTok HEIC with the public oEmbed JPEG before caching", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/heic" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          thumbnail_url: "https://p19-common-sign.tiktokcdn.com/thumb.jpeg",
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([4, 5, 6]), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const upload = vi.fn().mockResolvedValue({ error: null });
    const storageBucket = {
      upload,
      getPublicUrl: vi.fn(() => ({
        data: { publicUrl: "https://project.supabase.co/thumb.jpg" },
      })),
    };
    const supabase = {
      storage: { from: vi.fn(() => storageBucket) },
    };

    const result = await cacheResearchThumbnail({
      supabase: supabase as never,
      userId: "user-1",
      platform: "tiktok",
      externalId: "7604916235368713503",
      externalUrl:
        "https://www.tiktok.com/@creator/video/7604916235368713503",
      thumbnailUrl:
        "https://p16-common-sign.tiktokcdn-eu.com/cover.heic?signature=x",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(upload).toHaveBeenCalledWith(
      "user-1/tiktok/7604916235368713503.jpg",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/jpeg" }),
    );
    expect(result).toBe("https://project.supabase.co/thumb.jpg");
  });
});
