import { describe, expect, it } from "vitest";
import { followerCheckpoints, followerProgress, inferFollowerTarget, readFollowerGoal } from "./follower-goal";

describe("follower goal", () => {
  it("builds useful checkpoints up to the exact target", () => {
    expect(followerCheckpoints(10_000)).toEqual([100, 250, 500, 1000, 1500, 2000, 3000, 5000, 7500, 10000]);
    expect(followerCheckpoints(1_750)).toEqual([100, 250, 500, 1000, 1500, 1750]);
  });

  it("calculates bounded progress and reads persisted goals", () => {
    expect(followerProgress(2_500, 10_000)).toBe(25);
    expect(followerProgress(12_000, 10_000)).toBe(100);
    expect(readFollowerGoal({ follower_goal: { target: 10_000, current: 1200, connectionId: "ig", updatedAt: "2026-09-07" } })?.current).toBe(1200);
  });

  it("recognizes follower targets written in the roadmap goal", () => {
    expect(inferFollowerTarget("Reach 10K followers with CS content")).toBe(10_000);
    expect(inferFollowerTarget("Hit 1,500 engaged followers")).toBe(1_500);
    expect(inferFollowerTarget("Publish three videos weekly")).toBeNull();
  });
});
