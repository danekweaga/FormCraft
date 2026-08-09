import { describe, expect, it } from "vitest";
import { SAMPLE_GUARDS } from "./sample-guards";

describe("today backlog thresholds", () => {
  it("defines execution thresholds", () => {
    expect(SAMPLE_GUARDS.backlogIdeasThreshold).toBeGreaterThanOrEqual(10);
    expect(SAMPLE_GUARDS.backlogDraftsThreshold).toBeGreaterThanOrEqual(4);
  });
});
