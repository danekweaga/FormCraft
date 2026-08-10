import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALLOWED_AUDIO_MIME,
  ALLOWED_VIDEO_MIME,
  getAnalyzeLimits,
} from "../limits";
import { hashMediaBytes } from "./hash";

const BUCKET = "analysis-media";

export function assertAllowedMedia(params: {
  mimeType: string;
  sizeBytes: number;
  kind: "video" | "audio";
}) {
  const limits = getAnalyzeLimits();
  const allowed =
    params.kind === "video" ? ALLOWED_VIDEO_MIME : ALLOWED_AUDIO_MIME;
  if (!(allowed as readonly string[]).includes(params.mimeType)) {
    throw new Error(`Unsupported ${params.kind} type: ${params.mimeType}`);
  }
  const maxMb = params.kind === "video" ? limits.maxVideoMb : limits.maxAudioMb;
  if (params.sizeBytes > maxMb * 1024 * 1024) {
    throw new Error(`${params.kind} exceeds ${maxMb}MB limit.`);
  }
}

export async function uploadAnalysisMedia(params: {
  supabase: SupabaseClient;
  userId: string;
  analysisId: string;
  bytes: Buffer;
  filename: string;
  mimeType: string;
  kind: "video" | "audio" | "frame";
}): Promise<{ path: string; mediaHash: string }> {
  const mediaHash = hashMediaBytes(params.bytes);
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${params.userId}/${params.analysisId}/${params.kind}-${mediaHash.slice(0, 12)}-${safeName}`;

  const { error } = await params.supabase.storage
    .from(BUCKET)
    .upload(path, params.bytes, {
      contentType: params.mimeType,
      upsert: true,
    });
  if (error) throw new Error(error.message);

  return { path, mediaHash };
}

export async function createSignedMediaUrl(params: {
  supabase: SupabaseClient;
  path: string;
  expiresIn?: number;
}): Promise<string | null> {
  const { data, error } = await params.supabase.storage
    .from(BUCKET)
    .createSignedUrl(params.path, params.expiresIn ?? 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
