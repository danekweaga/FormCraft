import { describe, expect, it } from "vitest";
import {
  humanizeAiFallbackReason,
  parseModelJson,
  withContentIntelligence,
} from "./client";

describe("FormCraft AI client", () => {
  it("teaches every AI call the shared content system before task messages", () => {
    const messages = withContentIntelligence("pre_publish_review", [
      { role: "user", content: "Review this draft" },
    ]);

    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("FORMCRAFT CONTENT INTELLIGENCE");
    expect(messages[0]?.content).toContain("PRE-PUBLISH TASK");
    expect(messages[1]?.content).toBe("Review this draft");
  });

  it("repairs trailing commas and markdown fences when parsing model JSON", () => {
    const parsed = parseModelJson(
      '```json\n{"topic":"Test","items":["one","two",],}\n```',
    ) as { topic: string; items: string[] };
    expect(parsed.topic).toBe("Test");
    expect(parsed.items).toEqual(["one", "two"]);
  });

  it("humanizes parser errors instead of exposing raw JSON stack text", () => {
    expect(
      humanizeAiFallbackReason(
        "Model returned invalid JSON: Structured AI validation failed: Expected ',' or ']' after array element in JSON at position 6952 (line 85 column 8)",
      ),
    ).toBe(
      "The model returned a broken response. A built-in draft was used instead.",
    );
  });
});
