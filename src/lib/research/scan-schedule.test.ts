import { describe, expect, it } from "vitest";
import { nextDailyResearchRunAt } from "./scan-schedule";

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
