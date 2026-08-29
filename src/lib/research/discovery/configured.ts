import { isMetaInstagramDiscoveryConfigured } from "./meta-instagram-provider";
import { isScrapeCreatorsConfigured } from "./scrapecreators-client";
import { isTiktokDataApiConfigured } from "./tiktok-data-provider";

export function canDiscoverPlatform(platform: string): boolean {
  if (platform === "youtube") return false;
  if (platform === "tiktok") {
    return isScrapeCreatorsConfigured() || isTiktokDataApiConfigured();
  }
  if (platform === "instagram") {
    return (
      isMetaInstagramDiscoveryConfigured() || isScrapeCreatorsConfigured()
    );
  }
  return false;
}
