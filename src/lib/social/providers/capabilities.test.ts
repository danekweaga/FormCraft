import { describe, expect, it } from "vitest";
import {
  getOwnedProvider,
  PLATFORM_CARDS,
} from "./index";

describe("owned social providers", () => {
  it("declares capability matrices without inventing retention/comments", () => {
    for (const platform of ["instagram", "youtube", "tiktok"] as const) {
      const provider = getOwnedProvider(platform);
      expect(provider.capabilities.profile).toBe(true);
      expect(provider.capabilities.posts).toBe(true);
      expect(provider.capabilities.retention).toBe(false);
      expect(provider.capabilities.comments).toBe(false);
    }
  });

  it("marks future platforms as not connectable", () => {
    const later = PLATFORM_CARDS.filter((c) => c.comingLater);
    expect(later.map((c) => c.platform)).toEqual([
      "linkedin",
      "x",
      "threads",
    ]);
  });

  it("declares real Instagram account and audience insight support", () => {
    const instagram = getOwnedProvider("instagram");
    expect(instagram.capabilities.channelAnalytics).toBe(true);
    expect(instagram.capabilities.audienceInsights).toBe(true);
    expect(instagram.capabilities.retention).toBe(false);
  });

  it("reports unconfigured when env credentials are missing", () => {
    const prevMeta = process.env.META_APP_ID;
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    expect(getOwnedProvider("instagram").isConfigured()).toBe(false);
    expect(getOwnedProvider("instagram").unconfiguredReason()).toMatch(
      /not configured/i,
    );
    if (prevMeta) process.env.META_APP_ID = prevMeta;
  });
});
