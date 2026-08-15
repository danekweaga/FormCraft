import { describe, expect, it } from "vitest";
import {
  buildPerformanceAnalyticsCsv,
  performanceExportFilename,
} from "./export-analytics";
import type { ContentPostRow } from "./schemas";

function post(overrides: Partial<ContentPostRow> = {}): ContentPostRow {
  return {
    id: "1",
    platform: "instagram",
    source: "instagram_sync",
    source_label: "IG",
    title: 'Hello, "world"',
    caption: "caption",
    published_at: "2026-08-01T12:00:00.000Z",
    views: 10_000,
    likes: 100,
    comments: 10,
    shares: 5,
    saves: 20,
    followers_gained: null,
    reach: 8_000,
    is_winner: false,
    needs_review: false,
    relative_performance: { label: "above_median" },
    created_at: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildPerformanceAnalyticsCsv", () => {
  it("escapes commas/quotes and leaves null metrics blank", () => {
    const csv = buildPerformanceAnalyticsCsv([
      post({ views: null, likes: null, comments: null, shares: null, saves: null }),
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Hello, ""world"""');
    const dataLine = csv
      .trim()
      .split(/\r?\n/)
      .find((line) => line.startsWith("instagram,"));
    expect(dataLine).toBeTruthy();
    // views,reach,likes,comments,shares,saves after published_at — views blank
    expect(dataLine).toMatch(/instagram,"Hello, ""world""",2026-08-01T12:00:00.000Z,,8000,,,,/);
  });

  it("includes engagement rate when metrics exist", () => {
    const csv = buildPerformanceAnalyticsCsv([post()]);
    expect(csv).toContain("engagement_rate_pct");
    expect(csv).toMatch(/1\.69,reach/);
  });
});

describe("performanceExportFilename", () => {
  it("embeds range and date", () => {
    expect(
      performanceExportFilename("30", new Date("2026-08-15T00:00:00.000Z")),
    ).toBe("formcraft-performance-30-2026-08-15.xlsx");
  });
});
