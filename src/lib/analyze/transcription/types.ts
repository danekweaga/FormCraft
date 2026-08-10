export type TranscriptionInput = {
  /** Raw media bytes (video or audio Whisper accepts). */
  bytes: Buffer;
  filename: string;
  mimeType: string;
  languageHint?: string;
};

export type TranscriptSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type TranscriptResult = {
  rawTranscript: string;
  normalizedTranscript: string;
  language: string | null;
  confidence: number | null;
  provider: string;
  segments: TranscriptSegment[];
};

export interface TranscriptionProvider {
  name: string;
  transcribe(input: TranscriptionInput): Promise<TranscriptResult>;
}

export function normalizeTranscriptText(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\s([,.!?])/g, "$1")
    .replace(/([.!?])\s*/g, "$1 ")
    .trim();
}
