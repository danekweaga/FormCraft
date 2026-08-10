import { fetchYouTubeTranscript } from "@/lib/research/youtube-transcript";

export type UrlIngestResult =
  | {
      ok: true;
      platform: "youtube";
      videoId: string;
      transcript: string;
      thumbnailUrl: string | null;
      sourceUrl: string;
    }
  | {
      ok: false;
      reason: string;
      platform: string | null;
      suggestion: string;
    };

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "") || null;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/shorts/")) {
        return u.pathname.split("/")[2] || null;
      }
      return u.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

export async function ingestPublicVideoUrl(
  sourceUrl: string,
): Promise<UrlIngestResult> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return {
      ok: false,
      reason: "Empty URL",
      platform: null,
      suggestion: "Paste a URL or upload media / transcript.",
    };
  }

  const ytId = extractYouTubeId(trimmed);
  if (ytId) {
    const transcript = await fetchYouTubeTranscript(ytId);
    if (!transcript) {
      return {
        ok: false,
        reason: "Could not fetch YouTube captions for this video.",
        platform: "youtube",
        suggestion:
          "Upload the file, paste a transcript, or try another video with captions.",
      };
    }
    return {
      ok: true,
      platform: "youtube",
      videoId: ytId,
      transcript,
      thumbnailUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      sourceUrl: trimmed,
    };
  }

  if (/tiktok\.com/i.test(trimmed)) {
    return {
      ok: false,
      reason: "TikTok media cannot be downloaded automatically.",
      platform: "tiktok",
      suggestion: "Upload the video/audio file or paste a transcript.",
    };
  }
  if (/instagram\.com/i.test(trimmed)) {
    return {
      ok: false,
      reason: "Instagram media cannot be downloaded automatically.",
      platform: "instagram",
      suggestion: "Upload the Reel file or paste a transcript/caption.",
    };
  }
  if (/loom\.com/i.test(trimmed)) {
    return {
      ok: false,
      reason: "Loom download is not configured.",
      platform: "loom",
      suggestion: "Export/download the video and upload it, or paste a transcript.",
    };
  }

  return {
    ok: false,
    reason: "Unsupported or private URL.",
    platform: null,
    suggestion: "Upload media or paste a transcript for analysis.",
  };
}
