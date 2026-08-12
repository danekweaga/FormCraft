import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchSupadataTranscript,
  identifySupadataPlatform,
} from "./supadata-provider";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("identifySupadataPlatform", () => {
  it("accepts supported public social video hosts", () => {
    expect(identifySupadataPlatform("https://youtu.be/abc123")).toBe("youtube");
    expect(
      identifySupadataPlatform("https://www.tiktok.com/@creator/video/123"),
    ).toBe("tiktok");
    expect(
      identifySupadataPlatform("https://www.instagram.com/reel/abc/"),
    ).toBe("instagram");
    expect(identifySupadataPlatform("https://x.com/user/status/123")).toBe("x");
  });

  it("rejects lookalike and non-https hosts", () => {
    expect(identifySupadataPlatform("https://youtube.com.attacker.test/a")).toBeNull();
    expect(identifySupadataPlatform("http://www.tiktok.com/@x/video/1")).toBeNull();
  });
});

describe("fetchSupadataTranscript", () => {
  it("normalizes an immediate timestamped transcript", async () => {
    vi.stubEnv("SUPADATA_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            lang: "en",
            content: [
              { text: "Stop scrolling.", offset: 0, duration: 1200 },
              {
                text: "Your coding portfolio is missing this proof.",
                offset: 1200,
                duration: 2400,
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "x-billable-requests": "1",
            },
          },
        ),
      ),
    );

    const result = await fetchSupadataTranscript(
      "https://www.tiktok.com/@creator/video/123",
    );
    expect(result.provider).toBe("supadata_auto");
    expect(result.platform).toBe("tiktok");
    expect(result.billableRequests).toBe(1);
    expect(result.segments).toEqual([
      { startSeconds: 0, endSeconds: 1.2, text: "Stop scrolling." },
      {
        startSeconds: 1.2,
        endSeconds: 3.6,
        text: "Your coding portfolio is missing this proof.",
      },
    ]);
    expect(result.normalizedTranscript).toContain("coding portfolio");
  });

  it("polls asynchronous transcript jobs", async () => {
    vi.stubEnv("SUPADATA_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId: "job-1" }), {
          status: 202,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "completed",
            lang: "en",
            content: "This is a completed generated transcript for the video.",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSupadataTranscript(
      "https://www.instagram.com/reel/abc/",
      { pollIntervalMs: 0, maxPollMs: 2_000 },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.platform).toBe("instagram");
    expect(result.normalizedTranscript).toContain("completed generated transcript");
  });
});
