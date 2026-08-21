import { describe, expect, it } from "vitest";
import { calculateNextReportRun } from "./schedule";

describe("calculateNextReportRun", () => {
  const from = new Date("2026-08-20T13:30:00.000Z");
  it("returns null for manual reports", () => expect(calculateNextReportRun({ frequency: "manual", from })).toBeNull());
  it("moves a daily run into the future", () => expect(calculateNextReportRun({ frequency: "daily", scheduleConfig: { hour: 12 }, from })).toBe("2026-08-21T12:00:00.000Z"));
  it("schedules weekly and monthly runs", () => {
    expect(calculateNextReportRun({ frequency: "weekly", scheduleConfig: { weekday: 0, hour: 13 }, from })).toBe("2026-08-23T13:00:00.000Z");
    expect(calculateNextReportRun({ frequency: "monthly", scheduleConfig: { dayOfMonth: 1, hour: 12 }, from })).toBe("2026-09-01T12:00:00.000Z");
  });
});
