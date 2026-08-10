import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchYouTubeTranscript } from "./youtube-transcript";

describe("fetchYouTubeTranscript", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects malformed video ids without fetching", async () => {
    expect(await fetchYouTubeTranscript("")).toBeNull();
    expect(await fetchYouTubeTranscript("../evil")).toBeNull();
    expect(await fetchYouTubeTranscript("short")).toBeNull();
  });

  it("extracts the public caption track instead of failing at the JSON array boundary", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          'before "captionTracks":[{"baseUrl":"https://captions.example/timed","languageCode":"en"}] after',
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          '<transcript><text start="0">Stop scrolling. This spoken opening comes from the actual caption track.</text></transcript>',
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchYouTubeTranscript("abc12345678")).resolves.toBe(
      "Stop scrolling. This spoken opening comes from the actual caption track.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the free transcript endpoint and strips generator metadata", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("captions unavailable", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          [
            "# Transcript: Example title",
            "Source video: https://www.youtube.com/watch?v=abc12345678",
            "Language: en",
            "Interactive version: https://example.test",
            "",
            "## Transcript",
            "[0:00] Stop scrolling. This is the actual spoken opening from the generated transcript.",
            "[0:04] Here is the second sentence with enough evidence for analysis.",
          ].join("\n"),
          { status: 200, headers: { "Content-Type": "text/plain" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const transcript = await fetchYouTubeTranscript("abc12345678");

    expect(transcript).toBe(
      "Stop scrolling. This is the actual spoken opening from the generated transcript. Here is the second sentence with enough evidence for analysis.",
    );
    expect(transcript).not.toContain("Example title");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "youtube-transcript.ai/transcript/abc12345678.txt",
    );
  });
});
