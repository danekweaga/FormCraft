import { describe, expect, it } from "vitest";
import { mapInstagramPostMetrics } from "./instagram";

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
