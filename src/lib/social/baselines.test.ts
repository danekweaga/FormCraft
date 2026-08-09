import { describe, expect, it } from "vitest";
import {
  computeWindowBaselines,
  formatOutlierMultiplier,
  personalOutlierMultiplier,
} from "./baselines";

describe("social baselines", () => {
  const posts = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    published_at: new Date(Date.now() - i * 86_400_000).toISOString(),
    views: (i + 1) * 100,
    likes: (i + 1) * 10,
    comments: i,
    shares: null,
    saves: null,
    followers_gained: null,
  }));

  it("computes median baselines for last_10", () => {
    const result = computeWindowBaselines(posts, "last_10");
    expect(result.sampleSize).toBe(10);
    expect(result.medians.views).toBeTruthy();
  });

  it("formats outlier multipliers without inventing data", () => {
    expect(personalOutlierMultiplier(null, 100)).toBeNull();
    expect(personalOutlierMultiplier(280, 100)).toBeCloseTo(2.8);
    expect(formatOutlierMultiplier(2.8)).toBe("2.8× baseline");
  });
});
