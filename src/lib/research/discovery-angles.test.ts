import { describe, expect, it } from "vitest";
import {
  buildDiscoveryAngles,
  nextDiscoveryQueryBatch,
} from "./discovery-angles";

describe("buildDiscoveryAngles", () => {
  it("adds CS student lanes around a CS niche", () => {
    const angles = buildDiscoveryAngles({
      niche: "AI for CS students",
      keywords: ["internships"],
      topics: ["software engineering"],
    });
    expect(angles.some((query) => query.includes("cs") || query.includes("computer"))).toBe(
      true,
    );
    expect(angles).toContain("computer science student");
    expect(angles).toContain("leetcode interview prep");
    expect(angles).toContain("coding internship");
  });

  it("rotates query batches so each scan explores a different lane", () => {
    const queries = ["ai cs students", "tech news", "ai startup"];
    const first = nextDiscoveryQueryBatch(queries, 0, 2);
    const second = nextDiscoveryQueryBatch(queries, first.nextCursor, 2);
    expect(first.batch).toEqual(["ai cs students", "tech news"]);
    expect(second.batch).toEqual(["ai startup", "ai cs students"]);
  });

  it("does not spend discovery calls on broad saved topics", () => {
    const angles = buildDiscoveryAngles({
      niche: "computer science students",
      keywords: ["motivation", "breaking", "viral videos"],
      topics: ["software projects"],
    });
    expect(angles).not.toContain("motivation");
    expect(angles).not.toContain("breaking");
    expect(angles).not.toContain("viral videos");
    expect(angles).toContain("software projects");
  });
});
