import { describe, expect, it } from "vitest";
import { detectObservedRetentionChanges, parseRetentionCurve } from "./retention";

describe("observed retention curves", () => {
  it("preserves replay values above one", () => {
    const points = parseRetentionCurve("0,120\n5,105\n10,94", 10);
    expect(points[0]?.audienceWatchRatio).toBe(1.2);
    expect(points[1]?.audienceWatchRatio).toBe(1.05);
  });

  it("accepts normalized progress positions", () => {
    const points = parseRetentionCurve("0,1\n0.5,0.8\n1,0.7", 40);
    expect(points[1]?.elapsedSeconds).toBe(20);
    expect(points[2]?.elapsedSeconds).toBe(40);
  });

  it("detects persistent observed declines without claiming a cause", () => {
    const points = parseRetentionCurve(
      "0,100\n2,98\n4,90\n6,83\n8,80\n10,79",
      10,
    );
    const changes = detectObservedRetentionChanges(points);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0]?.note).toContain("Observed retention decline");
    expect(changes[0]?.note.toLowerCase()).not.toContain("bored");
  });
});

