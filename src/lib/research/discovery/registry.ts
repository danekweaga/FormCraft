import { demoDiscoveryProvider } from "./demo-provider";
import { scrapeCreatorsDiscoveryProvider } from "./scrapecreators-provider";
import { tiktokDataDiscoveryProvider } from "./tiktok-data-provider";
import { youtubeDiscoveryProvider } from "./youtube-provider";
import type { ContentDiscoveryProvider, DiscoveryCapabilities } from "./types";

export function listDiscoveryProviders(): ContentDiscoveryProvider[] {
  return [
    youtubeDiscoveryProvider,
    scrapeCreatorsDiscoveryProvider,
    tiktokDataDiscoveryProvider,
    demoDiscoveryProvider,
  ];
}

export function getConfiguredDiscoveryProviders(): ContentDiscoveryProvider[] {
  const configured = listDiscoveryProviders().filter(
    (p) =>
      p.capabilities().searchPosts || p.capabilities().getCreatorPosts,
  );
  const scrapeCreatorsOn = configured.some(
    (p) =>
      p.providerName === "scrapecreators" && p.capabilities().searchPosts,
  );
  // Prefer ScrapeCreators for TikTok so we do not double-fetch (and double-spend).
  if (scrapeCreatorsOn) {
    return configured.filter((p) => p.providerName !== "tiktokapi_store");
  }
  return configured;
}

export function getProviderForPlatform(
  platform: string,
): ContentDiscoveryProvider | null {
  return (
    getConfiguredDiscoveryProviders().find((p) =>
      p.capabilities().platforms.includes(platform as never),
    ) ?? null
  );
}

export function searchablePlatforms(): Array<{
  platform: string;
  providerName: string;
  providerType: DiscoveryCapabilities["providerType"];
}> {
  const out: Array<{
    platform: string;
    providerName: string;
    providerType: DiscoveryCapabilities["providerType"];
  }> = [];
  const seen = new Set<string>();
  for (const provider of getConfiguredDiscoveryProviders()) {
    const caps = provider.capabilities();
    if (!caps.searchPosts) continue;
    for (const platform of caps.platforms) {
      if (seen.has(platform)) continue;
      seen.add(platform);
      out.push({
        platform,
        providerName: provider.providerName,
        providerType: caps.providerType,
      });
    }
  }
  return out;
}
