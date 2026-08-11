import { describe, expect, it } from "vitest";
import { passesOutlierMinFilter } from "./ingest-posts";

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
