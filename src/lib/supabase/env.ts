export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

export function getSupabaseAnonKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return key;
}

export function getKnowledgeMaxFileBytes() {
  const raw = process.env.KNOWLEDGE_MAX_FILE_BYTES;
  const parsed = raw ? Number(raw) : 10_485_760;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10_485_760;
}

export function getMediaMaxFileBytes() {
  const raw = process.env.MEDIA_MAX_FILE_BYTES;
  const parsed = raw ? Number(raw) : 104_857_600;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 104_857_600;
}
