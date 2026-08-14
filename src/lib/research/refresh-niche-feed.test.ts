import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("./ensure-niche-auto-scan", () => ({
  ensureNicheAutoScan: vi.fn(async () => ({ scanId: "scan-1", created: false })),
}));

vi.mock("./run-scan", () => ({
  runResearchScan: vi.fn(async () => {
    throw new Error("provider down");
  }),
}));

import { refreshNicheFeedIfStale } from "./refresh-niche-feed";
import { runResearchScan } from "./run-scan";

describe("refreshNicheFeedIfStale", () => {
  it("clears refresh_claimed_at when the scan fails", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const supabase = {
      from: (table: string) => {
        expect(table).toBe("research_scans");
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "scan-1",
                    last_run_at: null,
                    parameters: {
                      discoveryMode: "niche_search",
                      force_full_discovery: true,
                    },
                  },
                }),
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            updates.push(payload);
            const chain = {
              eq: () => chain,
              or: () => chain,
              select: () => ({
                maybeSingle: async () => ({ data: { id: "scan-1" } }),
              }),
            };
            return chain;
          },
        };
      },
    };

    const result = await refreshNicheFeedIfStale({
      supabase: supabase as never,
      userId: "user-1",
    });

    expect(runResearchScan).toHaveBeenCalled();
    expect(result).toEqual({ ran: false, reason: "failed" });
    expect(updates.length).toBeGreaterThanOrEqual(2);
    const cleared = updates.at(-1)?.parameters as Record<string, unknown>;
    expect(cleared.refresh_claimed_at).toBeUndefined();
  });
});
