import { describe, expect, it } from "vitest";
import {
  buildHookStoryKnowledgeText,
  buildHookStoryPromptContext,
  getCanonicalHookTemplates,
  getHookStoryLibrarySummary,
  selectHookTemplates,
  selectScriptArchitecture,
} from "./starter-library";

describe("FormCraft Hook + Story starter library", () => {
  it("loads every canonical hook and preserves unique IDs", () => {
    const summary = getHookStoryLibrarySummary();
    const hooks = getCanonicalHookTemplates();

    expect(summary.canonicalHooks).toBe(267);
    expect(summary.architectures).toBe(11);
    expect(new Set(hooks.map((hook) => hook.canonical_id)).size).toBe(267);
    expect(hooks.every((hook) => hook.template.trim().length > 0)).toBe(true);
  });

  it("selects task-matched hooks deterministically without risky templates", () => {
    const first = selectHookTemplates({
      objective: "trust",
      format: "personal story",
      query: "a student project mistake",
      proofAvailable: false,
    });
    const second = selectHookTemplates({
      objective: "trust",
      format: "personal story",
      query: "a student project mistake",
      proofAvailable: false,
    });

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(3);
    expect(first.length).toBeLessThanOrEqual(8);
    expect(first.some((hook) => hook.family === "storytelling")).toBe(true);
    expect(first.every((hook) => hook.risk_flags.length === 0)).toBe(true);
  });

  it("chooses the matching story architecture and produces complete teaching text", () => {
    expect(selectScriptArchitecture("comparison / X vs Y").id).toBe("comparison");
    expect(selectScriptArchitecture("personal story").id).toBe("story_yap");

    const prompt = buildHookStoryPromptContext({
      objective: "education",
      format: "tutorial",
      query: "debugging for students",
      proofAvailable: true,
    });
    expect(prompt).toContain("Selected templates");
    expect(prompt).toContain("tutorial");
    expect(prompt).toContain("Ethical guardrails");

    const knowledge = buildHookStoryKnowledgeText();
    expect(knowledge).toContain("hook-001");
    expect(knowledge).toContain("hook-267");
    expect(knowledge).toContain("Never manufacture receipts");
  });
});
