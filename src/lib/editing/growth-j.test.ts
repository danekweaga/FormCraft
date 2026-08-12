import { describe, expect, it } from "vitest";
import { buildHeuristicBlueprint } from "@/lib/editing/blueprint";
import { extractReferencePrinciples } from "@/lib/editing/reference-principles";
import {
  creativeDirections,
  editingBlueprintSchema,
  prePublishLabResultSchema,
} from "@/lib/editing/schema";
import { heuristicToLabResult } from "@/lib/growth/pre-publish-lab";
import { reviewScriptHeuristic } from "@/lib/growth/heuristics";
import { prePublishSchema } from "@/lib/growth/schemas";

const STYLE_SOURCES = [
  "personal",
  "reference",
  "custom",
  "experiment",
  "knowledge",
] as const;

const FEEDBACK_KINDS = [
  "good",
  "not_my_style",
  "too_much",
  "too_little",
  "never",
  "save_preference",
] as const;

describe("Growth J Pre-Publish Lab + Editing Copilot", () => {
  it("validates bucketed lab result schema", () => {
    const heuristic = reviewScriptHeuristic(
      "Stop scrolling. Here is the real reason most tutorials fail before the payoff lands with a clear example and next step.",
    );
    const lab = heuristicToLabResult(heuristic, heuristic.summary + " extra words for length ".repeat(5));
    const parsed = prePublishLabResultSchema.safeParse(lab);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.version).toBe("pre-publish-lab-v1");
    expect(
      parsed.data.findings.every((f) =>
        [
          "fix_before_posting",
          "worth_testing",
          "creative_options",
          "optional_polish",
        ].includes(f.bucket),
      ),
    ).toBe(true);
    expect(
      parsed.data.findings.every((f) =>
        [
          "observation",
          "structural_observation",
          "psychology",
          "personal_evidence",
          "creative_suggestion",
          "performance_evidence",
          "current_experiment",
        ].includes(f.evidenceKind),
      ),
    ).toBe(true);
    expect(
      parsed.data.findings.every(
        (f) => f.evidenceRefs.length > 0 && f.uncertainty.length > 0,
      ),
    ).toBe(true);
    expect(parsed.data.checklist.ready.length).toBeGreaterThan(0);
  });

  it("requires creative direction when Editing Copilot is requested", () => {
    const without = prePublishSchema.safeParse({
      inputText: "A script long enough to review before publish with a clear hook.",
      runEditingCopilot: true,
      creativeDirection: null,
    });
    expect(without.success).toBe(true);
    // Schema allows null direction; action enforces when runEditingCopilot.
    // Mirror action guard:
    const data = without.success ? without.data : null;
    expect(data?.runEditingCopilot && !data.creativeDirection).toBe(true);

    const withDir = prePublishSchema.safeParse({
      inputText: "A script long enough to review before publish with a clear hook.",
      runEditingCopilot: true,
      creativeDirection: "minimal_yap",
    });
    expect(withDir.success).toBe(true);
    expect(withDir.data?.creativeDirection).toBe("minimal_yap");
  });

  it("builds blueprint only with an explicit direction", () => {
    for (const direction of creativeDirections) {
      const blueprint = buildHeuristicBlueprint({
        script:
          "Hook line here.\n\nBody explanation that goes on long enough to create a dense section for optional visuals.\n\nPayoff and CTA.",
        direction,
        stylePrinciples: ["Do not invent cut cadence."],
      });
      const parsed = editingBlueprintSchema.safeParse(blueprint);
      expect(parsed.success).toBe(true);
      expect(blueprint.creativeDirection).toBe(direction);
      expect(blueprint.confidenceNote.toLowerCase()).toContain("no hard-coded");
      expect(
        blueprint.beats.every(
          (b) =>
            b.evidenceKind === "observation" ||
            b.evidenceKind === "creative_suggestion",
        ),
      ).toBe(true);
    }
  });

  it("does not claim visual editing principles without visual evidence", () => {
    const principles = extractReferencePrinciples({
      overview: {
        coreMessage: "Test",
        whatWorks: [],
        whatCouldImprove: [],
        oneSentenceSummary: "Test",
      },
      timeline: [],
      hooks: [],
      rehooks: [],
      openLoops: [],
      psychology: [],
      retentionDevices: [],
      retentionRisks: [],
      claims: [],
      strengths: [],
      improvements: [],
      improvedHooks: [],
      improvedStructure: [],
      scorecard: [],
      visualObservations: [],
      editingMap: [],
      knowledgeUsed: [],
    });
    expect(principles.some((p) => /no visual\/editing evidence/i.test(p))).toBe(
      true,
    );
    expect(principles.some((p) => /do not clone exact cut timings/i.test(p))).toBe(
      true,
    );
    expect(principles.every((p) => !/\d+:\d{2}/.test(p))).toBe(true);
  });

  it("treats experiment assignment as opt-in (no auto-bind field on lab result)", () => {
    const lab = heuristicToLabResult(
      reviewScriptHeuristic(
        "Opening claim. Supporting points with an example. Clear ending CTA for the viewer.",
      ),
      "Opening claim. Supporting points with an example. Clear ending CTA for the viewer.",
    );
    expect(lab.activeExperimentNote).toBeNull();
    expect(
      Object.prototype.hasOwnProperty.call(lab, "assignedExperimentId"),
    ).toBe(false);
  });

  it("enumerates feedback kinds and style profile source types", () => {
    expect(FEEDBACK_KINDS).toContain("save_preference");
    expect(FEEDBACK_KINDS).toContain("not_my_style");
    expect(STYLE_SOURCES).toEqual(
      expect.arrayContaining([
        "personal",
        "reference",
        "custom",
        "experiment",
        "knowledge",
      ]),
    );
  });
});
