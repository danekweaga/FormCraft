import { describe, expect, it } from "vitest";
import {
  defaultDiscoveryPlatforms,
  normalizeSearchFilters,
} from "./search-filters";

describe("defaultDiscoveryPlatforms", () => {
  it("excludes youtube when other platforms exist", () => {
    expect(defaultDiscoveryPlatforms(["youtube", "tiktok"])).toEqual([
      "tiktok",
    ]);
  });

  it("keeps youtube when it is the only option", () => {
    expect(defaultDiscoveryPlatforms(["youtube"])).toEqual(["youtube"]);
  });
});

describe("normalizeSearchFilters", () => {
  it("defaults to non-youtube when platforms omitted", () => {
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
