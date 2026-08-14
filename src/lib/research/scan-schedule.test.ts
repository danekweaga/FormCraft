import { describe, expect, it } from "vitest";
import {
  incrementalLookbackDays,
  keepPostsPostedSince,
  nextDailyResearchRunAt,
  postedSinceCutoff,
  shouldRefreshOnVisit,
} from "./scan-schedule";

describe("nextDailyResearchRunAt", () => {
  it("uses today's cron window when it is still ahead", () => {
    expect(
      nextDailyResearchRunAt(new Date("2026-08-13T11:45:00.000Z")).toISOString(),
    ).toBe("2026-08-13T12:00:00.000Z");
  });

  it("uses tomorrow's cron window after a late manual pull", () => {
    expect(
      nextDailyResearchRunAt(new Date("2026-08-13T12:21:46.000Z")).toISOString(),
    ).toBe("2026-08-14T12:00:00.000Z");
  });

  it("does not immediately reschedule a run at the cron boundary", () => {
    expect(
      nextDailyResearchRunAt(new Date("2026-08-13T12:00:00.000Z")).toISOString(),
    ).toBe("2026-08-14T12:00:00.000Z");
  });
});

describe("visit-time incremental scan", () => {
  const now = new Date("2026-08-14T15:00:00.000Z");

  it("refreshes when the feed has never been scanned", () => {
    expect(shouldRefreshOnVisit(null, now)).toBe(true);
  });

  it("skips a visit refresh inside the cooldown window", () => {
    expect(
      shouldRefreshOnVisit("2026-08-14T14:50:00.000Z", now),
    ).toBe(false);
  });

  it("refreshes after the cooldown", () => {
    expect(
      shouldRefreshOnVisit("2026-08-14T14:40:00.000Z", now),
    ).toBe(true);
  });

  it("uses the full lookback on the first scan", () => {
    expect(incrementalLookbackDays(null, 30, now)).toBe(30);
  });

  it("only looks back as far as time since the last scan", () => {
    expect(
      incrementalLookbackDays("2026-08-14T12:00:00.000Z", 30, now),
    ).toBe(1);
    expect(
      incrementalLookbackDays("2026-08-11T15:00:00.000Z", 30, now),
    ).toBe(3);
  });

  it("keeps videos posted after the last scan and undated results", () => {
    const cutoff = postedSinceCutoff("2026-08-14T12:00:00.000Z");
    const kept = keepPostsPostedSince(
      [
        { publishedAt: "2026-08-14T13:00:00.000Z" },
        { publishedAt: "2026-08-13T10:00:00.000Z" },
        { publishedAt: null },
      ],
      cutoff,
    );
    expect(kept.map((post) => post.publishedAt)).toEqual([
      "2026-08-14T13:00:00.000Z",
      null,
    ]);
  });
});
