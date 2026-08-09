import { describe, expect, it } from "vitest";
import { shouldBlockIdeaGeneration } from "./backlog-guard";
import { SAMPLE_GUARDS } from "./sample-guards";

describe("backlog guard", () => {
  it("blocks when both ideas and drafts exceed thresholds", () => {
    expect(
      shouldBlockIdeaGeneration({
        unfinishedIdeas: SAMPLE_GUARDS.backlogIdeasThreshold,
        unfinishedDrafts: SAMPLE_GUARDS.backlogDraftsThreshold,
      }),
    ).toBe(true);
  });

  it("allows ideation when drafts are below threshold", () => {
    expect(
      shouldBlockIdeaGeneration({
        unfinishedIdeas: 20,
        unfinishedDrafts: 1,
      }),
    ).toBe(false);
  });

  it("allows ideation when ideas are below threshold", () => {
    expect(
      shouldBlockIdeaGeneration({
        unfinishedIdeas: 3,
        unfinishedDrafts: 10,
      }),
    ).toBe(false);
  });
});
