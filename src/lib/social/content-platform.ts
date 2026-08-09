import type { SocialPlatform } from "./types";

/** Map social connection platform → content_posts.platform enum */
export function toContentPlatform(
  platform: SocialPlatform | string,
  durationSeconds?: number | null,
): string {
  if (platform === "instagram") return "instagram";
  if (platform === "tiktok") return "tiktok";
  if (platform === "youtube") {
    if (durationSeconds != null && durationSeconds > 0 && durationSeconds <= 180) {
      return "youtube_shorts";
    }
    return "youtube";
  }
  if (platform === "linkedin") return "linkedin";
  if (platform === "x") return "x";
  if (platform === "threads") return "threads";
  return "other";
}
