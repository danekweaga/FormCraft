import { describe, expect, it } from "vitest";
import { passesOutlierMinFilter, retainByRelevance } from "./ingest-posts";

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
  it("does not drop TikTok when YouTube already has enough lexical hits", () => {
    const rows = [
      { video: { platform: "youtube", id: "a" }, relevance: { relevant: true } },
      { video: { platform: "youtube", id: "b" }, relevance: { relevant: true } },
      { video: { platform: "youtube", id: "c" }, relevance: { relevant: true } },
      { video: { platform: "tiktok", id: "t1" }, relevance: { relevant: false } },
      { video: { platform: "tiktok", id: "t2" }, relevance: { relevant: false } },
    ];
    const kept = retainByRelevance(rows);
    expect(kept.filter((r) => r.video.platform === "tiktok")).toHaveLength(2);
    expect(kept.filter((r) => r.video.platform === "youtube")).toHaveLength(3);
  });
});
