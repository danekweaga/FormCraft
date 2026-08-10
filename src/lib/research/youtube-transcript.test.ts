import { describe, expect, it } from "vitest";
import { fetchYouTubeTranscript } from "./youtube-transcript";

describe("fetchYouTubeTranscript", () => {
  it("rejects malformed video ids without fetching", async () => {
    expect(await fetchYouTubeTranscript("")).toBeNull();
    expect(await fetchYouTubeTranscript("../evil")).toBeNull();
    expect(await fetchYouTubeTranscript("short")).toBeNull();
  });
});
