import { describe, expect, it } from "vitest";
import {
  CONTENT_SYSTEM_STAGES,
  QUALITY_GATE_DIMENSIONS,
  SOURCE_STATUSES,
  contentIntelligencePromptBlock,
  routeFormat,
} from "./kernel";

describe("content intelligence kernel", () => {
  it("keeps the full creation-to-learning loop", () => {
    expect(CONTENT_SYSTEM_STAGES[0]?.key).toBe("identity");
    expect(CONTENT_SYSTEM_STAGES.at(-1)?.key).toBe("learning");
    expect(CONTENT_SYSTEM_STAGES.length).toBe(15);
  });

  it("defines the required source reliability statuses and quality gate", () => {
    expect(SOURCE_STATUSES).toContain("creator_claim");
    expect(SOURCE_STATUSES).toContain("research_or_platform");
    expect(QUALITY_GATE_DIMENSIONS).toHaveLength(14);
  });

  it("routes content needs to formats with an objective metric", () => {
    const [route] = routeFormat(["visual_proof"]);
    expect(route?.label).toContain("Screen-first");
    expect(route?.primaryMetric).toContain("saves");
  });

  it("adds task-specific rules and rejects invented proof", () => {
    const prompt = contentIntelligencePromptBlock("script_generation");
    expect(prompt).toContain("SCRIPT TASK");
    expect(prompt).toContain("instead of inventing it");
    expect(prompt).toContain("Never guarantee virality");
  });
});
