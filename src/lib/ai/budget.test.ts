import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getAiBudgets } from "./budget";
import { hashAiInput } from "./cache";
import { routeAIModel } from "./router";

describe("AI budget + routing", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.DAILY_AI_BUDGET_USD = "1";
    process.env.MONTHLY_AI_BUDGET_USD = "10";
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("reads budget env defaults", () => {
    expect(getAiBudgets()).toEqual({ dailyUsd: 1, monthlyUsd: 10 });
  });

  it("routes vision to multimodal and premium only on request", () => {
    expect(
      routeAIModel({
        taskType: "content_analysis",
        requiresVision: true,
      }),
    ).toBe("multimodal");
    expect(
      routeAIModel({
        taskType: "content_classification",
        complexity: "low",
      }),
    ).toBe("cheap");
    expect(
      routeAIModel({
        taskType: "idea_evaluation",
        userRequestedPremium: true,
      }),
    ).toBe("premium");
  });

  it("hashes cache keys deterministically", () => {
    expect(hashAiInput(["a", 1])).toBe(hashAiInput(["a", 1]));
    expect(hashAiInput(["a", 1])).not.toBe(hashAiInput(["a", 2]));
  });
});
