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
});
