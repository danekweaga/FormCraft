/**
 * Shared handle → platform creator id helpers for watchlists and scans.
 */

export function inferPlatformFromHandle(
  handle: string,
  platforms: string[],
): string | null {
  const raw = handle.trim();
  if (/^UC[\w-]{20,}$/i.test(raw) || raw.toLowerCase().startsWith("youtube:")) {
    return platforms.includes("youtube") || platforms.length === 0
      ? "youtube"
      : null;
  }
  if (raw.toLowerCase().startsWith("tiktok:")) return "tiktok";
  if (raw.toLowerCase().startsWith("instagram:")) return "instagram";
  if (platforms.includes("tiktok")) return "tiktok";
  if (platforms.includes("youtube")) return "youtube";
  return platforms[0] ?? null;
}

export function cleanCreatorHandle(handle: string): string {
  return handle
    .replace(/^youtube:/i, "")
    .replace(/^tiktok:/i, "")
    .replace(/^instagram:/i, "")
    .replace(/^@/, "")
    .trim();
}

export async function resolvePlatformCreatorId(params: {
  platform: string;
  handle: string;
}): Promise<string | null> {
  const cleaned = cleanCreatorHandle(params.handle);
  if (!cleaned) return null;

  if (params.platform === "youtube") {
    if (/^UC[\w-]{20,}$/i.test(cleaned)) return cleaned;
    const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim();
    if (!apiKey) return null;
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("part", "id");
    url.searchParams.set("forHandle", cleaned);
    const response = await fetch(url, { cache: "no-store" });
    const body = (await response.json()) as {
      items?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!response.ok || body.error) return null;
    return body.items?.[0]?.id ?? null;
  }

  if (params.platform === "tiktok" || params.platform === "instagram") {
    return cleaned;
  }

  return cleaned;
}
