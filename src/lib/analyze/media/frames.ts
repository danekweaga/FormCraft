import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnalyzeLimits } from "../limits";
import { uploadAnalysisMedia } from "./store";

export type CapturedFrame = {
  /** data URL or raw base64 jpeg/png */
  dataUrl: string;
  timestampSeconds: number;
};

function dataUrlToBuffer(dataUrl: string): { bytes: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid frame data URL.");
  const mimeType = match[1]!;
  const bytes = Buffer.from(match[2]!, "base64");
  return { bytes, mimeType };
}

export async function persistCapturedFrames(params: {
  supabase: SupabaseClient;
  userId: string;
  analysisId: string;
  frames: CapturedFrame[];
}): Promise<Array<{ path: string; timestampSeconds: number }>> {
  const limits = getAnalyzeLimits();
  const selected = params.frames.slice(0, limits.maxFrames);
  const out: Array<{ path: string; timestampSeconds: number }> = [];

  for (const [index, frame] of selected.entries()) {
    const { bytes, mimeType } = dataUrlToBuffer(frame.dataUrl);
    if (bytes.byteLength > limits.maxFrameBytes) continue;
    const uploaded = await uploadAnalysisMedia({
      supabase: params.supabase,
      userId: params.userId,
      analysisId: params.analysisId,
      bytes,
      filename: `frame-${index}.jpg`,
      mimeType,
      kind: "frame",
    });
    out.push({
      path: uploaded.path,
      timestampSeconds: frame.timestampSeconds,
    });
  }

  return out;
}
