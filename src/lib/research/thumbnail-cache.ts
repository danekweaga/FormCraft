import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "research-thumbnails";
const MAX_BYTES = 5 * 1024 * 1024;

function isAllowedThumbnailHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "i.ytimg.com" ||
    host.endsWith(".tiktokcdn.com") ||
    host.endsWith(".tiktokcdn-us.com") ||
    host.endsWith(".tiktokcdn-eu.com") ||
    host.endsWith(".cdninstagram.com") ||
    host.endsWith(".fbcdn.net")
  );
}

function extensionFor(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

/** Copy short-lived social CDN thumbnails to FormCraft's durable public cache. */
export async function cacheResearchThumbnail(params: {
  supabase: SupabaseClient;
  userId: string;
  platform: string;
  externalId: string;
  thumbnailUrl: string | null;
  externalUrl?: string | null;
}): Promise<string | null> {
  if (!params.thumbnailUrl || params.platform === "youtube") {
    return params.thumbnailUrl;
  }
  try {
    const source = new URL(params.thumbnailUrl);
    if (!isAllowedThumbnailHost(source.hostname)) return params.thumbnailUrl;
    let response = await fetch(source, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*",
        "User-Agent": "Mozilla/5.0 (compatible; FormCraft/1.0)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return params.thumbnailUrl;
    let contentType = response.headers.get("content-type") ?? "image/jpeg";
    // TikTok's primary CDN cover is often HEIC. Use the public oEmbed cover,
    // which is JPEG and costs no discovery-provider credits.
    if (
      params.platform === "tiktok" &&
      contentType.toLowerCase().includes("heic") &&
      params.externalUrl
    ) {
      await response.body?.cancel();
      const oembed = new URL("https://www.tiktok.com/oembed");
      oembed.searchParams.set("url", params.externalUrl);
      const oembedResponse = await fetch(oembed, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; FormCraft/1.0)" },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      const oembedBody = (await oembedResponse.json().catch(() => null)) as {
        thumbnail_url?: unknown;
      } | null;
      const fallbackUrl =
        typeof oembedBody?.thumbnail_url === "string"
          ? oembedBody.thumbnail_url
          : null;
      if (!oembedResponse.ok || !fallbackUrl) return params.thumbnailUrl;
      const fallbackSource = new URL(fallbackUrl);
      if (!isAllowedThumbnailHost(fallbackSource.hostname)) {
        return params.thumbnailUrl;
      }
      response = await fetch(fallbackSource, {
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*",
          "User-Agent": "Mozilla/5.0 (compatible; FormCraft/1.0)",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) return params.thumbnailUrl;
      contentType = response.headers.get("content-type") ?? "image/jpeg";
    }
    if (!contentType.startsWith("image/")) return params.thumbnailUrl;
    if (contentType.toLowerCase().includes("heic")) return params.thumbnailUrl;
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_BYTES) return params.thumbnailUrl;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return params.thumbnailUrl;

    const safeId = params.externalId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `${params.userId}/${params.platform}/${safeId}.${extensionFor(contentType)}`;
    const { error } = await params.supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) {
      console.warn("[research:thumbnail] cache upload failed", {
        platform: params.platform,
        externalId: params.externalId,
        reason: error.message,
      });
      return params.thumbnailUrl;
    }
    return params.supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (error) {
    console.warn("[research:thumbnail] cache fetch failed", {
      platform: params.platform,
      externalId: params.externalId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return params.thumbnailUrl;
  }
}
