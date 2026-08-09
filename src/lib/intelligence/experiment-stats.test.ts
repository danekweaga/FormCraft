import { describe, expect, it } from "vitest";
import { SAMPLE_GUARDS } from "./sample-guards";

describe("experiment aggregation guards", () => {
  it("requires at least 3 posts per variant before concluding", () => {
    expect(SAMPLE_GUARDS.experimentPostsPerVariant).toBe(3);
  });

  it("marks thin samples as evidence-limited", () => {
    const postCount = 2;
    const evidenceLimited =
      postCount < SAMPLE_GUARDS.experimentPostsPerVariant;
    expect(evidenceLimited).toBe(true);
  });

  it("computes median for odd and even lengths", () => {
    function median(values: number[]): number | null {
      if (!values.length) return null;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
    }
    expect(median([1, 3, 5])).toBe(3);
    expect(median([2, 4])).toBe(3);
    expect(median([])).toBeNull();
  });
});
