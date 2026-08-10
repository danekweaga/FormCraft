import {
  normalizeTranscriptText,
  type TranscriptionInput,
  type TranscriptionProvider,
  type TranscriptResult,
  type TranscriptSegment,
} from "./types";

/**
 * OpenAI Whisper transcription.
 * Accepts video/audio formats Whisper supports (mp4, webm, m4a, mp3, wav).
 */
export function createWhisperTranscriptionProvider(
  apiKey = process.env.OPENAI_API_KEY,
): TranscriptionProvider {
  return {
    name: "openai_whisper",
    async transcribe(input: TranscriptionInput): Promise<TranscriptResult> {
      if (!apiKey) {
        throw new Error(
          "OPENAI_API_KEY is not configured. Paste a transcript or add the key.",
        );
      }

      const form = new FormData();
      const blob = new Blob([new Uint8Array(input.bytes)], {
        type: input.mimeType || "application/octet-stream",
      });
      form.append("file", blob, input.filename || "media.mp4");
      form.append("model", "whisper-1");
      form.append("response_format", "verbose_json");
      if (input.languageHint) form.append("language", input.languageHint);

      const response = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Whisper transcription failed (${response.status}): ${detail.slice(0, 300)}`,
        );
      }

      const data = (await response.json()) as {
        text?: string;
        language?: string;
        duration?: number;
        segments?: Array<{
          start?: number;
          end?: number;
          text?: string;
          avg_logprob?: number;
        }>;
      };

      const raw = (data.text ?? "").trim();
      if (raw.length < 20) {
        throw new Error("Whisper returned an empty or too-short transcript.");
      }

      const segments: TranscriptSegment[] = (data.segments ?? [])
        .filter((s) => typeof s.text === "string" && s.text.trim())
        .map((s) => ({
          startSeconds: Number(s.start ?? 0),
          endSeconds: Number(s.end ?? s.start ?? 0),
          text: String(s.text).trim(),
        }));

      const confidences = (data.segments ?? [])
        .map((s) => s.avg_logprob)
        .filter((n): n is number => typeof n === "number");
      const confidence =
        confidences.length > 0
          ? Math.exp(
              confidences.reduce((a, b) => a + b, 0) / confidences.length,
            )
          : null;

      return {
        rawTranscript: raw,
        normalizedTranscript: normalizeTranscriptText(raw),
        language: data.language ?? null,
        confidence,
        provider: "openai_whisper",
        segments,
      };
    },
  };
}

export function getDefaultTranscriptionProvider(): TranscriptionProvider {
  return createWhisperTranscriptionProvider();
}
