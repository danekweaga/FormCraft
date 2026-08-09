import { demoDiscoveryProvider } from "./demo-provider";
import { youtubeDiscoveryProvider } from "./youtube-provider";
import type { ContentDiscoveryProvider, DiscoveryCapabilities } from "./types";

export function listDiscoveryProviders(): ContentDiscoveryProvider[] {
  return [youtubeDiscoveryProvider, demoDiscoveryProvider];
}

export function getConfiguredDiscoveryProviders(): ContentDiscoveryProvider[] {
  return listDiscoveryProviders().filter((p) => p.capabilities().searchPosts);
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
  for (const provider of getConfiguredDiscoveryProviders()) {
    const caps = provider.capabilities();
    for (const platform of caps.platforms) {
      out.push({
        platform,
        providerName: provider.providerName,
        providerType: caps.providerType,
      });
    }
  }
  return out;
}
