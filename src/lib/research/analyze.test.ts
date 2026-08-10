import { describe, expect, it } from "vitest";
import { analyzeResearchBatch } from "./analyze";

describe("analyzeResearchBatch transcript enrichment", () => {
  it("uses metadata_and_transcript when captions are supplied", async () => {
    const supabase = {
      from: () => ({
        insert: async () => ({ error: null }),
      }),
    } as never;

    const result = await analyzeResearchBatch({
      supabase,
      userId: "user-1",
      query: "computer science",
      videos: [
        {
          platform: "youtube",
          externalId: "abc12345678",
          externalUrl: "https://youtube.com/watch?v=abc12345678",
          creatorId: null,
          creatorName: "Test",
          title: "Why pointers confuse beginners",
          description: "A short explanation",
          thumbnailUrl: null,
          publishedAt: null,
          durationSeconds: 60,
          views: 100_000,
          likes: 1000,
          comments: 50,
          shares: null,
          baselineViews: 10_000,
          outlierScore: 10,
          scoreBasis: "creator_median",
        },
      ],
      transcriptsByExternalId: new Map([
        [
          "abc12345678",
          "Stop scrolling. Most beginners learn pointers the wrong way. Here is the mental model that finally clicked for me. First think of memory as a street of houses. Then a pointer is just the address on the mailbox. Once you see that, star and amp make sense.",
        ],
      ]),
    });

    const analysis = result.get("abc12345678")?.analysis;
    expect(analysis?.evidenceBasis).toBe("metadata_and_transcript");
    expect(analysis?.structureBeats?.length).toBeGreaterThan(0);
    expect(analysis?.caution.toLowerCase()).toContain("transcript");
  });

  it("never presents a title as a spoken hook without transcript evidence", async () => {
    const supabase = {
      from: () => ({ insert: async () => ({ error: null }) }),
    } as never;

    const result = await analyzeResearchBatch({
      supabase,
      userId: "user-1",
      query: "computer science",
      videos: [
        {
          platform: "youtube",
          externalId: "abc12345678",
          externalUrl: "https://youtube.com/watch?v=abc12345678",
          creatorId: null,
          creatorName: "Test",
          title: "This is metadata, not a spoken hook",
          description: "A caption supplied by the platform",
          thumbnailUrl: null,
          publishedAt: null,
          durationSeconds: 60,
          views: 1000,
          likes: 10,
          comments: 1,
          shares: null,
          baselineViews: 500,
          outlierScore: 2,
          scoreBasis: "creator_median",
        },
      ],
    });

    const analysis = result.get("abc12345678")?.analysis;
    expect(analysis?.evidenceBasis).toBe("metadata_only");
    expect(analysis?.hookText).toBeNull();
    expect(analysis?.hookType).toBeNull();
    expect(analysis?.structureBeats).toBeUndefined();
  });
});
