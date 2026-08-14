import { describe, expect, it } from "vitest";
import { captionMetadataTranscript } from "./url";

describe("captionMetadataTranscript", () => {
  it("returns caption text when long enough", () => {
    expect(
      captionMetadataTranscript({
        title: "Short",
        description:
          "Nobody told CS students that debugging is the real skill they need.",
      }),
    ).toContain("debugging");
  });

  it("returns null when metadata is too short", () => {
    expect(
      captionMetadataTranscript({ title: "Hi", description: "ok" }),
    ).toBeNull();
  });
});
