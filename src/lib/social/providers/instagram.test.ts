import { describe, expect, it } from "vitest";
import { mapInstagramPostMetrics, buildInstagramAuthorizationUrl } from "./instagram";

describe("Instagram authorization URL", () => {
  it("forces a new login and matches the production callback", () => {
    const url = new URL(
      buildInstagramAuthorizationUrl({
        appId: "1545712593920042",
        redirectUri:
          "https://form-craft-phi.vercel.app/api/social/instagram/callback",
        state: "state-token",
        scopes: [
          "instagram_business_basic",
          "instagram_business_manage_insights",
        ],
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://www.instagram.com/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("1545712593920042");
    expect(url.searchParams.get("force_reauth")).toBe("true");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://form-craft-phi.vercel.app/api/social/instagram/callback",
    );
    expect(url.searchParams.get("scope")).toContain(
      "instagram_business_manage_insights",
    );
  });

  it("uses config_id instead of scope when Meta login config is set", () => {
    const url = new URL(
      buildInstagramAuthorizationUrl({
        appId: "1545712593920042",
        redirectUri: "https://form-craft-phi.vercel.app/api/social/instagram/callback",
        state: "state-token",
        scopes: ["instagram_business_basic"],
        configId: "123456",
      }),
    );
    expect(url.searchParams.get("config_id")).toBe("123456");
    expect(url.searchParams.get("scope")).toBeNull();
  });
});

describe("Instagram media insight mapping", () => {
  it("converts Meta watch milliseconds and preserves the real skip rate", () => {
    const metrics = mapInstagramPostMetrics(
      "post-id",
      new Map([
        ["views", 1000],
        ["ig_reels_video_view_total_time", 123_000],
        ["ig_reels_avg_watch_time", 4_500],
        ["reels_skip_rate", 37.5],
      ]),
    );

    expect(metrics.watchTimeSeconds).toBe(123);
    expect(metrics.averageViewDurationSeconds).toBe(4.5);
    expect(metrics.completionRate).toBeNull();
    expect(metrics.extra?.reels_skip_rate).toBe(37.5);
  });

  it("maps non-reel attribution without inventing link clicks", () => {
    const metrics = mapInstagramPostMetrics(
      "post-id",
      new Map([
        ["follows", 2],
        ["profile_visits", 9],
      ]),
    );

    expect(metrics.followersGained).toBe(2);
    expect(metrics.profileVisits).toBe(9);
    expect(metrics.linkClicks).toBeNull();
  });
});
