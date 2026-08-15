import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_OPENROUTER_MODELS,
  resolveModelName,
} from "./router";
import { TASK_MODEL_TIER } from "./types";

afterEach(() => {
  delete process.env.AI_MODEL_CHEAP;
  delete process.env.AI_MODEL_STANDARD;
  delete process.env.AI_MODEL_PREMIUM;
  delete process.env.AI_MODEL_MULTIMODAL;
  delete process.env.OPENROUTER_CHEAP_MODEL;
  delete process.env.OPENROUTER_STANDARD_MODEL;
  delete process.env.OPENROUTER_PREMIUM_MODEL;
  delete process.env.OPENROUTER_MULTIMODAL_MODEL;
});

describe("resolveModelName", () => {
  it("uses the tiered OpenRouter defaults", () => {
    expect(resolveModelName("cheap")).toBe(DEFAULT_OPENROUTER_MODELS.cheap);
    expect(resolveModelName("standard")).toBe(
      DEFAULT_OPENROUTER_MODELS.standard,
    );
    expect(resolveModelName("premium")).toBe(
      DEFAULT_OPENROUTER_MODELS.premium,
    );
    expect(resolveModelName("multimodal")).toBe(
      DEFAULT_OPENROUTER_MODELS.multimodal,
    );
  });

  it("routes deep analysis and editing to premium", () => {
    expect(TASK_MODEL_TIER.content_analysis).toBe("premium");
    expect(TASK_MODEL_TIER.pre_publish_review).toBe("premium");
    expect(TASK_MODEL_TIER.editing_guidance).toBe("premium");
    expect(TASK_MODEL_TIER.script_generation).toBe("premium");
    expect(TASK_MODEL_TIER.weekly_review).toBe("premium");
    expect(TASK_MODEL_TIER.content_classification).toBe("cheap");
    expect(TASK_MODEL_TIER.lesson_generation).toBe("cheap");
  });
});
