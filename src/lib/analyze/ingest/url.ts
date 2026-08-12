import {
  fetchSupadataTranscript,
  identifySupadataPlatform,
  isSupadataConfigured,
  type SupadataPlatform,
} from "@/lib/analyze/transcription/supadata-provider";
import type { TranscriptSegment } from "@/lib/analyze/transcription/types";
import { fetchYouTubeTranscript } from "@/lib/research/youtube-transcript";

export type UrlIngestResult =
  | {
      ok: true;
      platform: SupadataPlatform;
      videoId: string | null;
      transcript: string;
      rawTranscript: string;
      transcriptProvider: string;
      transcriptLanguage: string | null;
      timestampedTranscript: TranscriptSegment[];
      billableRequests: number | null;
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
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.replace("/", "") || null;
    }
    if (
      parsed.hostname === "youtube.com" ||
      parsed.hostname.endsWith(".youtube.com")
    ) {
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/")[2] || null;
      }
      return parsed.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

function platformSuggestion(platform: SupadataPlatform): string {
  if (platform === "youtube") {
    return "Try another public video, paste a transcript, or upload the media.";
  }
  return "Confirm the video opens in a signed-out browser, or paste/upload its transcript instead.";
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

  const platform = identifySupadataPlatform(trimmed);
  if (!platform) {
    return {
      ok: false,
      reason: "Unsupported or non-public URL.",
      platform: null,
      suggestion:
        "Use a public YouTube, TikTok, Instagram, Facebook, or X video URL, or upload media.",
    };
  }

  // YouTube captions are frequently available without a paid transcription
  // request. Use that path first and reserve Supadata credits for videos that
  // need generated speech-to-text (especially TikTok and Instagram).
  if (platform === "youtube") {
    const videoId = extractYouTubeId(trimmed);
    const transcript = videoId
      ? await fetchYouTubeTranscript(videoId)
      : null;
    if (transcript) {
      return {
        ok: true,
        platform,
        videoId,
        transcript,
        rawTranscript: transcript,
        transcriptProvider: "youtube_captions",
        transcriptLanguage: null,
        timestampedTranscript: [],
        billableRequests: 0,
        thumbnailUrl: videoId
          ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          : null,
        sourceUrl: trimmed,
      };
    }
  }

  if (isSupadataConfigured()) {
    try {
      const transcript = await fetchSupadataTranscript(trimmed);
      const videoId = platform === "youtube" ? extractYouTubeId(trimmed) : null;
      return {
        ok: true,
        platform,
        videoId,
        transcript: transcript.normalizedTranscript,
        rawTranscript: transcript.rawTranscript,
        transcriptProvider: transcript.provider,
        transcriptLanguage: transcript.language,
        timestampedTranscript: transcript.segments,
        billableRequests: transcript.billableRequests,
        thumbnailUrl:
          platform === "youtube" && videoId
            ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            : null,
        sourceUrl: trimmed,
      };
    } catch (error) {
      if (platform !== "youtube") {
        return {
          ok: false,
          reason:
            error instanceof Error
              ? error.message
              : "Supadata could not create a transcript.",
          platform,
          suggestion: platformSuggestion(platform),
        };
      }
      // The final response below explains that neither captions nor Supadata
      // produced usable spoken evidence.
    }
  }

  return {
    ok: false,
    reason: isSupadataConfigured()
      ? "No usable public transcript was returned."
      : "SUPADATA_API_KEY is not configured for social-video transcripts.",
    platform,
    suggestion: platformSuggestion(platform),
  };
}
