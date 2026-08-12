import { afterEach, describe, expect, it, vi } from "vitest";
import { ingestPublicVideoUrl } from "./url";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ingestPublicVideoUrl", () => {
  it("rejects empty urls", async () => {
    const result = await ingestPublicVideoUrl("");
    expect(result.ok).toBe(false);
  });

  it("explains when TikTok transcription is not configured", async () => {
    vi.stubEnv("SUPADATA_API_KEY", "");
    const result = await ingestPublicVideoUrl(
      "https://www.tiktok.com/@user/video/123",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.platform).toBe("tiktok");
      expect(result.reason).toContain("SUPADATA_API_KEY");
    }
  });

  it("ingests an Instagram transcript through Supadata", async () => {
    vi.stubEnv("SUPADATA_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            lang: "en",
            content: [
              {
                text: "This opening line is grounded in the spoken transcript.",
                offset: 0,
                duration: 2200,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const result = await ingestPublicVideoUrl(
      "https://www.instagram.com/reel/abc123/",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.platform).toBe("instagram");
      expect(result.transcriptProvider).toBe("supadata_auto");
      expect(result.timestampedTranscript).toHaveLength(1);
    }
  });

  it("rejects arbitrary URLs instead of using Supadata as an SSRF relay", async () => {
    vi.stubEnv("SUPADATA_API_KEY", "test-key");
    const result = await ingestPublicVideoUrl("https://internal.example/video.mp4");
    expect(result.ok).toBe(false);
  });
});
