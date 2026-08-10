import { describe, expect, it } from "vitest";
import { hashTranscript } from "./transcript-hash";
import { hashMediaBytes, hashMediaString } from "./media/hash";
import {
  buildAnalysisCacheKey,
  hashContextBlock,
  hashFramesList,
} from "./cache/keys";
import {
  normalizeAnalysisResult,
  scoreToRating,
  subjectToSourceType,
} from "./schema";
import { analyzeTranscriptHeuristic } from "./heuristic";
import { getAnalyzeLimits } from "./limits";

describe("Growth I analyze helpers", () => {
  it("hashes transcripts stably after trim", () => {
    expect(hashTranscript("hello")).toBe(hashTranscript("hello"));
    expect(hashTranscript("hello")).toBe(hashTranscript("hello "));
    expect(hashTranscript("hello")).not.toBe(hashTranscript("hello!"));
  });

  it("hashes media bytes", () => {
    const a = hashMediaBytes(Buffer.from("abc"));
    const b = hashMediaBytes(Buffer.from("abc"));
    expect(a).toBe(b);
    expect(hashMediaString("abc")).toHaveLength(64);
  });

  it("builds cache keys from parts", () => {
    const key = buildAnalysisCacheKey({
      transcriptHash: "t",
      mode: "deep",
      contextHash: hashContextBlock("ctx"),
      framesHash: hashFramesList([{ path: "a", timestampSeconds: 1 }]),
      promptVersion: "v1",
    });
    expect(key).toHaveLength(64);
  });

  it("orders timeline timestamps ascending for heuristic", () => {
    const result = analyzeTranscriptHeuristic(
      "Stop scrolling. Here is why tutorials fail. But wait — there is a better way. For example I shipped a project. Follow for more.",
      "deep",
    );
    for (let i = 1; i < result.timeline.length; i += 1) {
      expect(result.timeline[i]!.startSeconds).toBeGreaterThanOrEqual(
        result.timeline[i - 1]!.startSeconds,
      );
    }
  });

  it("guards visual categories when no visual evidence", () => {
    const result = analyzeTranscriptHeuristic(
      "A long enough transcript for analysis with some claims that you should always test carefully.",
      "quick",
      { hasVisualEvidence: false },
    );
    const visual = result.scorecard.find((s) => s.category === "Visual communication");
    expect(visual?.rating).toBe("Unable to Evaluate");
    expect(result.visualObservations).toEqual([]);
    expect(result.editingMap).toEqual([]);
  });

  it("normalizes legacy overview string results", () => {
    const normalized = normalizeAnalysisResult({
      overview: "Old string overview",
      timeline: [{ startLabel: "0:00", segment: "Hi", purpose: "Hook" }],
      hooks: [{ text: "Hi", type: "Statement", effectiveness: "moderate" }],
      openLoops: [],
      psychology: [],
      retentionDevices: [],
      potentialRetentionRisks: [],
      claims: [],
      strengths: ["ok"],
      improvements: [{ area: "Hook", suggestion: "Tighten", priority: "high" }],
      improvedHooks: [],
      recommendedStructure: "Hook then body",
      scorecard: [{ category: "Hook", score: 7, rationale: "fine" }],
      confidenceNotes: ["legacy"],
    });
    expect(normalized.overview.coreMessage).toContain("Old string");
    expect(normalized.improvements[0]?.priority).toBe("high");
    expect(normalized.scorecard[0]?.rating).toBe(scoreToRating(7));
  });

  it("maps subject types to source types", () => {
    expect(subjectToSourceType("own_content")).toBe("my_content");
    expect(subjectToSourceType("draft")).toBe("draft");
    expect(subjectToSourceType("unknown", "transcript_paste")).toBe(
      "transcript_only",
    );
  });

  it("exposes configurable limits", () => {
    const limits = getAnalyzeLimits();
    expect(limits.maxFrames).toBeGreaterThan(0);
    expect(limits.maxVideoMb).toBeGreaterThan(0);
  });
});
