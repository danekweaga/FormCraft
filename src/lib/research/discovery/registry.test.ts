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

  it("prefers ScrapeCreators for TikTok and Instagram and keeps official YouTube", () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "sc-key");
    vi.stubEnv("YOUTUBE_DATA_API_KEY", "yt-key");
    vi.stubEnv("TIKTOK_DATA_API_KEY", "tt-store-key");
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
      "scrapecreators",
    );

    const platforms = searchablePlatforms().map((p) => p.platform);
    expect(platforms).toEqual(["youtube", "tiktok", "instagram"]);
  });
});
