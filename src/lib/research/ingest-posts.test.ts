import { describe, expect, it } from "vitest";
import {
  passesOutlierMinFilter,
  retainByRelevance,
  retainKeywordSearchHits,
  sourceLabel,
} from "./ingest-posts";

describe("research source provenance", () => {
  it("labels TikTokAPI.store rows as third-party API data", () => {
    expect(sourceLabel("tiktokapi_store")).toBe("third_party_api");
    expect(sourceLabel("youtube_data_api")).toBe("official_api");
    expect(sourceLabel("demo")).toBe("manual_reference");
  });
});

describe("passesOutlierMinFilter", () => {
  it("keeps null outlier scores when a minimum is set", () => {
    expect(passesOutlierMinFilter(null, 1.5)).toBe(true);
    expect(passesOutlierMinFilter(undefined, 1.5)).toBe(true);
  });

  it("drops scored posts below the minimum", () => {
    expect(passesOutlierMinFilter(1.2, 1.5)).toBe(false);
  });

  it("keeps scored posts at or above the minimum", () => {
    expect(passesOutlierMinFilter(1.5, 1.5)).toBe(true);
    expect(passesOutlierMinFilter(3, 1.5)).toBe(true);
  });
});

describe("retainByRelevance", () => {
  it("keeps only videos that pass the niche gate", () => {
    const rows = [
      { video: { platform: "youtube", id: "a" }, relevance: { relevant: true } },
      { video: { platform: "youtube", id: "b" }, relevance: { relevant: true } },
      { video: { platform: "youtube", id: "c" }, relevance: { relevant: true } },
      { video: { platform: "youtube", id: "d" }, relevance: { relevant: false } },
      { video: { platform: "tiktok", id: "t1" }, relevance: { relevant: false } },
      { video: { platform: "tiktok", id: "t2" }, relevance: { relevant: false } },
    ];
    expect(retainByRelevance(rows)).toHaveLength(3);
  });
});

describe("retainKeywordSearchHits", () => {
  it("keeps in-lane search hits that lack a title keyword match", () => {
    const rows = [
      {
        video: { id: "keep" },
        relevance: {
          relevant: false,
          relevanceReason: "Outside the allowed student-tech/developer content universe",
          topic: "query",
          format: null,
          audience: null,
        },
      },
      {
        video: { id: "drop" },
        relevance: {
          relevant: false,
          relevanceReason: "Matches an excluded off-niche topic",
          topic: "query",
          format: null,
          audience: null,
        },
      },
    ];
    const kept = retainKeywordSearchHits(rows);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.video.id).toBe("keep");
    expect(kept[0]?.relevance.relevant).toBe(true);
  });
});
