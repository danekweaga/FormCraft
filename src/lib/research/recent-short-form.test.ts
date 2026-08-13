import { describe, expect, it } from "vitest";
import { isRecentShortForm } from "./recent-short-form";

const now = Date.UTC(2026, 7, 10);
const base = {
  platform: "youtube" as const,
  publishedAt: new Date(now - 10 * 86_400_000).toISOString(),
  durationSeconds: 90,
};

describe("recent short-form filter", () => {
  it("keeps a recent YouTube Short", () => {
    expect(isRecentShortForm(base, { now })).toBe(true);
  });

  it("rejects videos older than 30 days", () => {
    expect(isRecentShortForm({ ...base, publishedAt: new Date(now - 31 * 86_400_000).toISOString() }, { now })).toBe(false);
  });

  it("keeps YouTube shorts under 4 minutes", () => {
    expect(isRecentShortForm({ ...base, durationSeconds: 200 }, { now })).toBe(
      true,
    );
  });

  it("rejects long YouTube uploads", () => {
    expect(isRecentShortForm({ ...base, durationSeconds: 241 }, { now })).toBe(
      false,
    );
  });

  it("keeps recent TikTok posts when duration is unavailable", () => {
    expect(isRecentShortForm({ ...base, platform: "tiktok", durationSeconds: null }, { now })).toBe(true);
  });

  it("keeps TikTok posts with unknown publish date", () => {
    expect(
      isRecentShortForm(
        { platform: "tiktok", publishedAt: null, durationSeconds: null },
        { now },
      ),
    ).toBe(true);
  });

  it("keeps TikTok posts within 90 days even if scan lookback is 30", () => {
    expect(
      isRecentShortForm(
        {
          platform: "tiktok",
          publishedAt: new Date(now - 60 * 86_400_000).toISOString(),
          durationSeconds: 40,
        },
        { now, lookbackDays: 30 },
      ),
    ).toBe(true);
  });

  it("uses an exact 30-day window for tracked creator feeds", () => {
    expect(
      isRecentShortForm(
        {
          platform: "tiktok",
          publishedAt: new Date(now - 60 * 86_400_000).toISOString(),
          durationSeconds: 40,
        },
        { now, lookbackDays: 30, strictLookback: true },
      ),
    ).toBe(false);
  });

  it("rejects YouTube posts with unknown publish date", () => {
    expect(
      isRecentShortForm(
        { platform: "youtube", publishedAt: null, durationSeconds: 40 },
        { now },
      ),
    ).toBe(false);
  });

  it("normalizes millisecond durations as short-form", () => {
    expect(
      isRecentShortForm(
        { ...base, platform: "tiktok", durationSeconds: 15_200 },
        { now },
      ),
    ).toBe(true);
  });
});
