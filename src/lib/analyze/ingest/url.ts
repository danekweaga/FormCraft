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
  return "Tap Analyze again in a few seconds, or paste/upload the caption or transcript.";
}

/** On-screen caption/title when speech-to-text times out — not spoken evidence. */
export function captionMetadataTranscript(fields: {
  title?: string | null;
  description?: string | null;
  hookText?: string | null;
}): string | null {
  const text = [fields.description, fields.title, fields.hookText]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n\n")
    .trim();
  return text.length >= 20 ? text : null;
}

export async function ingestPublicVideoUrl(
  sourceUrl: string,
  options?: { maxPollMs?: number },
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
      console.info("[transcript:ingest] success", {
        platform,
        provider: "youtube_captions",
        characters: transcript.length,
        billableRequests: 0,
      });
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
      const transcript = await fetchSupadataTranscript(trimmed, {
        maxPollMs: options?.maxPollMs,
      });
      const videoId = platform === "youtube" ? extractYouTubeId(trimmed) : null;
      console.info("[transcript:ingest] success", {
        platform,
        provider: transcript.provider,
        characters: transcript.normalizedTranscript.length,
        billableRequests: transcript.billableRequests,
      });
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
        console.warn("[transcript:ingest] failed", {
          platform,
          reason:
            error instanceof Error
              ? error.message
              : "Supadata could not create a transcript.",
        });
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

  const failure = {
    ok: false,
    reason: isSupadataConfigured()
      ? "No usable public transcript was returned."
      : "SUPADATA_API_KEY is not configured for social-video transcripts.",
    platform,
    suggestion: platformSuggestion(platform),
  } as const;
  console.warn("[transcript:ingest] failed", {
    platform,
    reason: failure.reason,
  });
  return failure;
}
