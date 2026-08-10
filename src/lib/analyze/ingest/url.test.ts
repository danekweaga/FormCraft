import { describe, expect, it } from "vitest";
import { ingestPublicVideoUrl } from "./url";

describe("ingestPublicVideoUrl", () => {
  it("rejects empty urls", async () => {
    const result = await ingestPublicVideoUrl("");
    expect(result.ok).toBe(false);
  });

  it("honestly refuses tiktok auto-download", async () => {
    const result = await ingestPublicVideoUrl(
      "https://www.tiktok.com/@user/video/123",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.platform).toBe("tiktok");
      expect(result.suggestion.toLowerCase()).toContain("upload");
    }
  });

  it("honestly refuses instagram auto-download", async () => {
    const result = await ingestPublicVideoUrl(
      "https://www.instagram.com/reel/abc123/",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.platform).toBe("instagram");
    }
  });
});
