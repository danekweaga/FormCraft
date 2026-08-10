import { describe, expect, it } from "vitest";
import { normalizeTiktokVideo } from "./tiktok-data-provider";

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
    expect(normalizeTiktokVideo({ desc: "no id" }, "2026-08-10T12:00:00.000Z")).toBeNull();
  });
});
