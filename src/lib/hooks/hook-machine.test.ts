import { describe, expect, it } from "vitest";
import {
  HOOK_MACHINE_SYSTEM_PROMPT,
  extractMadLibFormula,
} from "./hook-machine";

describe("Hook Machine prompt", () => {
  it("includes Kallaway universal principles and anti-patterns", () => {
    expect(HOOK_MACHINE_SYSTEM_PROMPT).toContain("Rapid Context");
    expect(HOOK_MACHINE_SYSTEM_PROMPT).toContain("Contrast / Curiosity Loop");
    expect(HOOK_MACHINE_SYSTEM_PROMPT).toContain("Instant Value Promise");
    expect(HOOK_MACHINE_SYSTEM_PROMPT).toContain("Throat-clearing openers");
    expect(HOOK_MACHINE_SYSTEM_PROMPT).toMatch(/em-dash/i);
    expect(HOOK_MACHINE_SYSTEM_PROMPT).toContain("B+");
  });

  it("turns numbers into mad-lib slots", () => {
    expect(extractMadLibFormula("This hit 13.7 million views in 30 days")).toContain(
      "[number]",
    );
  });
});
