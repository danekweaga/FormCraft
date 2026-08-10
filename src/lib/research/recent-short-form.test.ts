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

  it("rejects long YouTube uploads", () => {
    expect(isRecentShortForm({ ...base, durationSeconds: 181 }, { now })).toBe(false);
  });

  it("keeps recent TikTok posts when duration is unavailable", () => {
    expect(isRecentShortForm({ ...base, platform: "tiktok", durationSeconds: null }, { now })).toBe(true);
  });
});
