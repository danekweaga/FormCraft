import { describe, expect, it } from "vitest";
import {
  confidenceFromSample,
  hasEnoughForComparison,
  notEnoughEvidenceMessage,
  SAMPLE_GUARDS,
} from "./sample-guards";

describe("sample guards", () => {
  it("requires minimum group sizes", () => {
    expect(hasEnoughForComparison(2, 3)).toBe(false);
    expect(hasEnoughForComparison(3, 3)).toBe(true);
  });

  it("labels confidence from sample size", () => {
    expect(confidenceFromSample(2)).toBe("low");
    expect(confidenceFromSample(SAMPLE_GUARDS.performanceLessonMinPosts)).toBe(
      "medium",
    );
    expect(confidenceFromSample(20)).toBe("high");
  });

  it("formats not-enough message", () => {
    expect(notEnoughEvidenceMessage(5, 2)).toMatch(/2\/5/);
  });
});
