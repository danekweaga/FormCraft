import { describe, expect, it } from "vitest";
import { isValidOpenRouterModelId } from "./preferences";

describe("OpenRouter model preferences", () => {
  it("accepts provider/model IDs and variants", () => {
    expect(isValidOpenRouterModelId("anthropic/claude-sonnet-5")).toBe(true);
    expect(isValidOpenRouterModelId("nvidia/model-name:free")).toBe(true);
  });

  it("rejects URLs, whitespace, and unqualified IDs", () => {
    expect(isValidOpenRouterModelId("https://openrouter.ai/model")).toBe(false);
    expect(isValidOpenRouterModelId("provider/model name")).toBe(false);
    expect(isValidOpenRouterModelId("model-only")).toBe(false);
  });
});

