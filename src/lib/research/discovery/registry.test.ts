import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getConfiguredDiscoveryProviders,
  getProviderForPlatform,
  searchablePlatforms,
} from "./registry";

describe("discovery registry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers official Meta for Instagram and keeps ScrapeCreators for broad search", () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "sc-key");
    vi.stubEnv("YOUTUBE_DATA_API_KEY", "yt-key");
    vi.stubEnv("TIKTOK_DATA_API_KEY", "tt-store-key");
    vi.stubEnv("META_BUSINESS_DISCOVERY_ACCESS_TOKEN", "meta-token");
    vi.stubEnv("META_BUSINESS_DISCOVERY_IG_USER_ID", "17841439075121762");
    vi.stubEnv("RESEARCH_ENABLE_DEMO", "");

    const names = getConfiguredDiscoveryProviders().map((p) => p.providerName);
    expect(names).toContain("scrapecreators");
    expect(names).toContain("youtube_data_api");
    expect(names).not.toContain("tiktokapi_store");

    expect(getProviderForPlatform("youtube")?.providerName).toBe(
      "youtube_data_api",
    );
    expect(getProviderForPlatform("tiktok")?.providerName).toBe("scrapecreators");
    expect(getProviderForPlatform("instagram")?.providerName).toBe(
      "meta_instagram_business_discovery",
    );

    const platforms = searchablePlatforms().map((p) => p.platform);
    expect(platforms).toEqual(["youtube", "tiktok", "instagram"]);
  });
});
