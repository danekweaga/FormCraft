import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function hashAiInput(parts: unknown[]): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(parts));
  return hash.digest("hex");
}

export async function readAiCache<T>(params: {
  supabase: SupabaseClient;
  userId: string;
  cacheKey: string;
}): Promise<T | null> {
  const { data } = await params.supabase
    .from("ai_result_cache")
    .select("result")
    .eq("user_id", params.userId)
    .eq("cache_key", params.cacheKey)
    .maybeSingle();
  if (!data?.result) return null;
  return data.result as T;
}

export async function writeAiCache(params: {
  supabase: SupabaseClient;
  userId: string;
  cacheKey: string;
  jobType: string;
  promptVersion: string;
  model: string | null;
  result: unknown;
}) {
  await params.supabase.from("ai_result_cache").upsert(
    {
      user_id: params.userId,
      cache_key: params.cacheKey,
      job_type: params.jobType,
      prompt_version: params.promptVersion,
      model: params.model,
      result: params.result as object,
    },
    { onConflict: "user_id,cache_key" },
  );
}
