import type { OwnedPlatform } from "./types";

function present(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getAppUrl(): string {
  return (
    present(process.env.NEXT_PUBLIC_APP_URL) ??
    present(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    "http://localhost:3000"
  );
}

export function getOAuthCallbackUrl(platform: OwnedPlatform): string {
  return `${getAppUrl()}/api/social/${platform}/callback`;
}

export function getTokenEncryptionKey(): string | null {
  return present(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY);
}

export function instagramConfig() {
  return {
    appId: present(process.env.META_APP_ID),
    appSecret: present(process.env.META_APP_SECRET),
    // Instagram API with Instagram Login (preferred) or Graph via Facebook Login
    configId: present(process.env.INSTAGRAM_LOGIN_CONFIG_ID),
    graphVersion: present(process.env.META_GRAPH_API_VERSION) ?? "v21.0",
  };
}

export function youtubeConfig() {
  return {
    clientId: present(process.env.GOOGLE_CLIENT_ID),
    clientSecret: present(process.env.GOOGLE_CLIENT_SECRET),
  };
}

export function tiktokConfig() {
  return {
    clientKey: present(process.env.TIKTOK_CLIENT_KEY),
    clientSecret: present(process.env.TIKTOK_CLIENT_SECRET),
  };
}

export function isPlatformConfigured(platform: OwnedPlatform): boolean {
  if (platform === "instagram") {
    const cfg = instagramConfig();
    return Boolean(cfg.appId && cfg.appSecret);
  }
  if (platform === "youtube") {
    const cfg = youtubeConfig();
    return Boolean(cfg.clientId && cfg.clientSecret);
  }
  const cfg = tiktokConfig();
  return Boolean(cfg.clientKey && cfg.clientSecret);
}

export function platformUnconfiguredReason(platform: OwnedPlatform): string | null {
  if (isPlatformConfigured(platform)) return null;
  if (platform === "instagram") {
    return "Instagram connection not configured. Add META_APP_ID and META_APP_SECRET.";
  }
  if (platform === "youtube") {
    return "YouTube connection not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.";
  }
  return "TikTok connection not configured. Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET.";
}

/** Scopes we request when configured. Actual grants may be a subset. */
export const REQUESTED_SCOPES = {
  instagram: [
    "instagram_business_basic",
    "instagram_business_manage_insights",
  ],
  youtube: [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
  ],
  tiktok: ["user.info.basic", "user.info.stats", "video.list"],
} as const;
