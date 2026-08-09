import { describe, expect, it } from "vitest";
import {
  connectionFollowerCount,
  connectionFreshness,
  formatFollowerCount,
  freshnessMetadataForAi,
  sourceLabelForSynced,
} from "./freshness";

describe("freshness", () => {
  it("flags disconnected and sync required states", () => {
    expect(
      connectionFreshness({
        status: "disconnected",
        lastSuccessfulSyncAt: null,
        lastError: null,
      }).kind,
    ).toBe("disconnected");

    expect(
      connectionFreshness({
        status: "connected",
        lastSuccessfulSyncAt: null,
        lastError: "token expired",
      }).kind,
    ).toBe("sync_required");
  });

  it("reads follower counts from connection metadata without inventing values", () => {
    expect(connectionFollowerCount(null)).toBeNull();
    expect(connectionFollowerCount({})).toBeNull();
    expect(connectionFollowerCount({ follower_count: 1200 })).toBe(1200);
    expect(
      connectionFollowerCount({
        profile: { followerCount: 88 },
      }),
    ).toBe(88);
    expect(formatFollowerCount(null)).toBe("Unavailable");
    expect(formatFollowerCount(1200)).toBe("1,200");
  });

  it("builds source labels and AI freshness metadata without tokens", () => {
    const label = sourceLabelForSynced(
      "instagram",
      new Date(Date.now() - 18 * 60_000).toISOString(),
    );
    expect(label).toMatch(/Instagram · Synced/i);

    const meta = freshnessMetadataForAi({
      lastSuccessfulSyncAt: new Date().toISOString(),
      metricsRefreshedAt: new Date().toISOString(),
      connectionStatus: "connected",
    });
    expect(JSON.stringify(meta)).not.toMatch(/access_token/i);
    expect(meta.data_freshness.stale).toBe(false);
  });
});
