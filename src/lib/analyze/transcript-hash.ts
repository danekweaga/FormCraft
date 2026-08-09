import { createHash } from "crypto";

export function hashTranscript(transcript: string): string {
  return createHash("sha256").update(transcript.trim()).digest("hex");
}
