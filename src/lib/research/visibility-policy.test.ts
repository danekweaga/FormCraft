import { describe, expect, it } from "vitest";
import {
  meetsForYouViewFloor,
  meetsResearchViewFloor,
} from "./visibility-policy";

describe("research view floors", () => {
  it("keeps the hard 20k floor for outliers", () => {
    expect(meetsResearchViewFloor(19_999)).toBe(false);
    expect(meetsResearchViewFloor(20_000)).toBe(true);
    expect(meetsResearchViewFloor(null)).toBe(false);
  });

  it("lets For You show unknown Instagram views and softer floors", () => {
    expect(meetsForYouViewFloor(null)).toBe(true);
    expect(meetsForYouViewFloor(4_999)).toBe(false);
    expect(meetsForYouViewFloor(5_000)).toBe(true);
  });
});
