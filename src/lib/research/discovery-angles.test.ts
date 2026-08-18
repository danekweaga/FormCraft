import { describe, expect, it } from "vitest";
import {
  buildDiscoveryAngles,
  nextDiscoveryQueryBatch,
} from "./discovery-angles";

describe("buildDiscoveryAngles", () => {
  it("adds tech news and model-release lanes around an AI niche", () => {
    const angles = buildDiscoveryAngles({
      niche: "AI for CS students",
      keywords: ["internships"],
      topics: ["software engineering"],
    });
    expect(angles.some((query) => query.includes("ai"))).toBe(true);
    expect(angles).toContain("ai coding news");
    expect(angles).toContain("tech news developers");
    expect(angles).toContain("ai developer tools");
  });

  it("rotates query batches so each scan explores a different lane", () => {
    const queries = ["ai cs students", "tech news", "ai startup"];
    const first = nextDiscoveryQueryBatch(queries, 0, 2);
    const second = nextDiscoveryQueryBatch(queries, first.nextCursor, 2);
    expect(first.batch).toEqual(["ai cs students", "tech news"]);
    expect(second.batch).toEqual(["ai startup", "ai cs students"]);
  });
});
