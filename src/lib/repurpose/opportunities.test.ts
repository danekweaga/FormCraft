import { describe, expect, it } from "vitest";
import { evaluateRepurposing, relativeMultiple } from "./opportunities";

describe("repurposing opportunity engine", () => {
  const base = {
    id: "post-1",
    title: "A practical debugging workflow",
    caption: "Debug the boundary before changing the implementation.",
    views: 1200,
    isWinner: false,
    needsReview: false,
  };

  it("extracts nested baseline ratios", () => {
    expect(relativeMultiple({ ...base, relativePerformance: { views: { ratio: 1.6 } } })).toBe(1.6);
  });

  it("says not worth repurposing when evidence is weak", () => {
    const result = evaluateRepurposing({ ...base, relativePerformance: { views: 0.8 } });
    expect(result).toHaveLength(1);
    expect(result[0]?.opportunityType).toBe("not_worth");
  });

  it("creates evidence-backed options for a winner", () => {
    const result = evaluateRepurposing({
      ...base,
      isWinner: true,
      saves: 32,
      relativePerformance: { views: { ratio: 1.8 } },
    });
    expect(result.map((item) => item.opportunityType)).toEqual([
      "remake",
      "follow_up",
      "social_post",
      "carousel",
    ]);
    expect(result[0]?.evidence.join(" ")).toContain("1.80x");
  });
});
