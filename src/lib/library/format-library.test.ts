import { describe, expect, it } from "vitest";
import { inferFormatFromEvidence } from "./format-library";

describe("inferFormatFromEvidence", () => {
  it("detects screen recordings from coding language", () => {
    expect(
      inferFormatFromEvidence({
        title: "Debugging this API in VS Code",
        description: "Screen share of the terminal error",
      }),
    ).toBe("screen-recording");
  });

  it("detects tutorials and yaps", () => {
    expect(
      inferFormatFromEvidence({
        title: "How to build a portfolio in 7 days",
        description: "Step-by-step tutorial",
      }),
    ).toBe("tutorial");
    expect(
      inferFormatFromEvidence({
        hookText: "Stop applying to internships like this",
        title: "Hot take",
      }),
    ).toBe("yap");
  });
});
