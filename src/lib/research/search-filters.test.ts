import { describe, expect, it } from "vitest";
import {
  compactDiscoveryQuery,
  defaultDiscoveryPlatforms,
  normalizeSearchFilters,
} from "./search-filters";

describe("defaultDiscoveryPlatforms", () => {
  it("includes youtube when other platforms exist", () => {
    expect(defaultDiscoveryPlatforms(["youtube", "tiktok"])).toEqual([
      "youtube",
      "tiktok",
    ]);
  });

  it("keeps youtube when it is the only option", () => {
    expect(defaultDiscoveryPlatforms(["youtube"])).toEqual(["youtube"]);
  });
});

describe("normalizeSearchFilters", () => {
  it("defaults to all configured platforms including youtube", () => {
    const filters = normalizeSearchFilters({
      query: "ai careers",
      allowedPlatforms: ["youtube", "tiktok"],
    });
    expect(filters.platforms).toEqual(["youtube", "tiktok"]);
  });

  it("supports legacy preferNonYoutubeDefault", () => {
    const filters = normalizeSearchFilters({
      query: "ai careers",
      allowedPlatforms: ["youtube", "tiktok"],
      preferNonYoutubeDefault: true,
    });
    expect(filters.platforms).toEqual(["tiktok"]);
  });

  it("honors explicit youtube opt-in", () => {
    const filters = normalizeSearchFilters({
      query: "ai careers",
      platforms: ["youtube", "tiktok"],
      allowedPlatforms: ["youtube", "tiktok"],
    });
    expect(filters.platforms).toEqual(["youtube", "tiktok"]);
  });

  it("defaults min outlier score to 0 for first pulls", () => {
    const filters = normalizeSearchFilters({
      query: "niche",
      platforms: ["tiktok"],
      allowedPlatforms: ["tiktok"],
    });
    expect(filters.minOutlierScore).toBe(0);
    expect(filters.maxResults).toBe(50);
  });

  it("compacts long niche sentences for TikTok search", () => {
    expect(compactDiscoveryQuery("AI for CS students internships")).toBe(
      "ai cs students",
    );
  });

  it("parses channel handles and creator ids", () => {
    const filters = normalizeSearchFilters({
      query: "niche",
      platforms: ["tiktok"],
      allowedPlatforms: ["tiktok"],
      creatorIds: ["11111111-1111-1111-1111-111111111111"],
      channelHandles: "@creator_one\ntiktok:other",
    });
    expect(filters.creatorIds).toHaveLength(1);
    expect(filters.channelHandles).toContain("creator_one");
  });
});
