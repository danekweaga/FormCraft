import { describe, expect, it } from "vitest";
import {
  evaluateIdeaHeuristic,
  reviewScriptHeuristic,
  splitCommentPaste,
} from "./heuristics";

describe("evaluateIdeaHeuristic", () => {
  it("pursues a specific audience + outcome idea", () => {
    const result = evaluateIdeaHeuristic(
      "How CS students can land their first internship without a FAANG resume so that they get interviews faster",
    );
    expect(result.recommendation).toBe("pursue");
    expect(result.confidenceNote).toMatch(/deferred/i);
  });

  it("reshapes vague short ideas", () => {
    const result = evaluateIdeaHeuristic("viral tips and hacks");
    expect(["reshape", "park", "kill"]).toContain(result.recommendation);
  });
});

describe("reviewScriptHeuristic", () => {
  it("returns stub confidence note", () => {
    const result = reviewScriptHeuristic(
      "Stop studying like this.\n\nHere is the system I used to ship projects.\nFollow for part 2.",
    );
    expect(result.mode).toBe("heuristic_stub");
    expect(result.confidenceNote).toMatch(/deferred/i);
    expect(result.checks.length).toBeGreaterThan(0);
  });
});

describe("splitCommentPaste", () => {
  it("splits non-empty lines", () => {
    expect(splitCommentPaste("one\n\ntwo\n  ")).toEqual(["one", "two"]);
  });
});
