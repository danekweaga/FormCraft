import type { OwnedPlatform, OwnedSocialProvider, SocialPlatform } from "../types";
import { instagramOwnedProvider } from "./instagram";
import { tiktokOwnedProvider } from "./tiktok";
import { youtubeOwnedProvider } from "./youtube";

const OWNED_PROVIDERS: Record<OwnedPlatform, OwnedSocialProvider> = {
  instagram: instagramOwnedProvider,
  youtube: youtubeOwnedProvider,
  tiktok: tiktokOwnedProvider,
};

export function getOwnedProvider(platform: OwnedPlatform): OwnedSocialProvider {
  return OWNED_PROVIDERS[platform];
}

export function isOwnedPlatform(platform: string): platform is OwnedPlatform {
  return platform === "instagram" || platform === "youtube" || platform === "tiktok";
}

export type PlatformCardDefinition = {
  platform: SocialPlatform;
  name: string;
  connectable: boolean;
  comingLater?: boolean;
  description: string;
};

export const PLATFORM_CARDS: PlatformCardDefinition[] = [
  {
    platform: "instagram",
    name: "Instagram",
    connectable: true,
    description:
      "Connect your Instagram professional account for media and supported insights.",
  },
  {
    platform: "youtube",
    name: "YouTube",
    connectable: true,
    description:
      "Connect your owned YouTube channel for videos/Shorts and supported analytics.",
  },
  {
    platform: "tiktok",
    name: "TikTok",
    connectable: true,
    description:
      "Connect via TikTok Login/Display scopes that your app has approved.",
  },
  {
    platform: "linkedin",
    name: "LinkedIn",
    connectable: false,
    comingLater: true,
    description: "Not configured in this phase.",
  },
  {
    platform: "x",
    name: "X",
    connectable: false,
    comingLater: true,
    description: "Not configured in this phase.",
  },
  {
    platform: "threads",
    name: "Threads",
    connectable: false,
    comingLater: true,
    description: "Not configured in this phase.",
  },
];

export {
  instagramOwnedProvider,
  youtubeOwnedProvider,
  tiktokOwnedProvider,
};
