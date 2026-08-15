import { describe, expect, it } from "vitest";
import {
  ANALYSIS_TITLE_MAX,
  clipAnalysisTitle,
  createAnalysisInputSchema,
} from "./schema";

describe("clipAnalysisTitle", () => {
  it("clips long research captions instead of failing", () => {
    const long = "a".repeat(ANALYSIS_TITLE_MAX + 80);
    expect(clipAnalysisTitle(long)).toHaveLength(ANALYSIS_TITLE_MAX);
  });

  it("uses fallback when empty", () => {
    expect(clipAnalysisTitle("  ", "Research breakdown")).toBe(
      "Research breakdown",
    );
  });
});

describe("createAnalysisInputSchema title", () => {
  it("accepts oversized titles by clipping", () => {
    const long = `Hook ${"x".repeat(300)}`;
    const parsed = createAnalysisInputSchema.safeParse({
      title: long,
      transcript: "This is a long enough spoken transcript for analysis.",
      mode: "deep",
      subjectType: "viral_outlier",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toHaveLength(ANALYSIS_TITLE_MAX);
    }
  });
});
