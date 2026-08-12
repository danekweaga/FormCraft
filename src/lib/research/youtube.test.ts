import { describe, expect, it } from "vitest";
import { isExcludedYoutubeChannelCountry } from "./youtube";

describe("isExcludedYoutubeChannelCountry", () => {
  it("excludes channels explicitly associated with India", () => {
    expect(isExcludedYoutubeChannelCountry("IN")).toBe(true);
    expect(isExcludedYoutubeChannelCountry(" in ")).toBe(true);
  });

  it("keeps Canadian, US, and unspecified channels", () => {
    expect(isExcludedYoutubeChannelCountry("CA")).toBe(false);
    expect(isExcludedYoutubeChannelCountry("US")).toBe(false);
    expect(isExcludedYoutubeChannelCountry(null)).toBe(false);
  });
});
