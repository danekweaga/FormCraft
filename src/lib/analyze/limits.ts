/** Configurable Analysis Lab limits (env-backed). */

function positiveInt(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function getAnalyzeLimits() {
  return {
    maxVideoMb: positiveInt("ANALYZE_MAX_VIDEO_MB", 100),
    maxAudioMb: positiveInt("ANALYZE_MAX_AUDIO_MB", 50),
    maxDurationSeconds: positiveInt("ANALYZE_MAX_DURATION_SECONDS", 600),
    maxTranscriptChars: positiveInt("ANALYZE_MAX_TRANSCRIPT_CHARS", 200_000),
    maxFrames: positiveInt("ANALYZE_MAX_FRAMES", 8),
    maxFrameBytes: positiveInt("ANALYZE_MAX_FRAME_BYTES", 1_500_000),
  };
}

export const ALLOWED_VIDEO_MIME = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const ALLOWED_AUDIO_MIME = [
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
] as const;
