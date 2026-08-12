import { describe, expect, it } from "vitest";
import { withContentIntelligence } from "./client";

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
});
