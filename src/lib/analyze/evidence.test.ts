import { describe, expect, it } from "vitest";
import { buildDeterministicEvidence } from "./evidence";

describe("deterministic temporal evidence", () => {
  it("keeps visual claims unavailable for transcript-only analysis", () => {
    const result = buildDeterministicEvidence({
      hasVisualEvidence: false,
      timeline: [
        {
          startSeconds: 0,
          endSeconds: 12,
          type: "Hook",
          transcript:
            "Why do most student projects look like homework? The reason is that the proof arrives too late.",
          purpose: "Opening",
          assessment: "Transcript",
        },
      ],
    });
    const firstFrame = result.hookWindows.find(
      (window) => window.window === "first_frame",
    );
    expect(firstFrame?.available).toBe(false);
    expect(firstFrame?.assessment).toContain("no visual evidence");
    expect(result.attentionSupport.find((item) => item.dimension === "meaningful_visual_support")?.status).toBe(
      "unavailable",
    );
  });

  it("preserves a defensible open-loop resolution timestamp", () => {
    const result = buildDeterministicEvidence({
      hasVisualEvidence: false,
      timeline: [
        {
          startSeconds: 0,
          endSeconds: 15,
          type: "Hook",
          transcript:
            "Why does this portfolio fail? Most people blame the framework. The answer is that it never proves an engineering decision.",
          purpose: "Opening",
          assessment: "Transcript",
        },
      ],
    });
    expect(result.openLoops[0]?.resolvedAt).not.toBeNull();
    expect(result.openLoops[0]?.resolved).toBe(true);
  });

  it("does not hallucinate a payoff for an unresolved question", () => {
    const result = buildDeterministicEvidence({
      hasVisualEvidence: false,
      timeline: [
        {
          startSeconds: 0,
          endSeconds: 8,
          type: "Hook",
          transcript: "What actually makes a project interview-worthy? Let me explain the background.",
          purpose: "Opening",
          assessment: "Transcript",
        },
      ],
    });
    expect(result.openLoops[0]?.resolvedAt).toBeNull();
    expect(result.openLoops[0]?.assessment).toContain("unresolved");
    expect(
      result.evidenceFindings.some((finding) =>
        finding.id.startsWith("finding:unresolved-loop"),
      ),
    ).toBe(true);
  });

  it("requires semantic justification for a rehook candidate", () => {
    const result = buildDeterministicEvidence({
      hasVisualEvidence: false,
      timeline: [
        {
          startSeconds: 0,
          endSeconds: 18,
          type: "Body",
          transcript:
            "Most students list their stack. But here is the problem: what decision did the project prove? For example, show the tradeoff you made.",
          purpose: "Development",
          assessment: "Transcript",
        },
      ],
    });
    expect(result.rehooks.length).toBeGreaterThan(0);
    expect(result.rehooks[0]?.purpose).toMatch(/reversal|question|evidence|shift/);
  });
});

