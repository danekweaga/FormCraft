import { createHash } from "node:crypto";

export function buildAnalysisCacheKey(parts: {
  transcriptHash: string;
  mode: string;
  contextHash: string;
  framesHash: string;
  promptVersion: string;
}): string {
  return createHash("sha256")
    .update(
      [
        parts.promptVersion,
        parts.mode,
        parts.transcriptHash,
        parts.contextHash,
        parts.framesHash,
      ].join("|"),
    )
    .digest("hex");
}

export function hashContextBlock(block: string | null | undefined): string {
  return createHash("sha256")
    .update(block?.trim() || "")
    .digest("hex")
    .slice(0, 32);
}

export function hashFramesList(
  frames: Array<{ path?: string; timestampSeconds?: number }>,
): string {
  const normalized = frames
    .map((f) => `${f.path ?? ""}@${f.timestampSeconds ?? ""}`)
    .sort()
    .join(",");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}
