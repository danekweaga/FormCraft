import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function hashReportToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createReportAccessToken(params: {
  supabase: SupabaseClient;
  userId: string;
  label?: string;
}) {
  const token = `fc_reports_${randomBytes(24).toString("hex")}`;
  const { data, error } = await params.supabase.from("report_access_tokens").insert({
    user_id: params.userId,
    label: params.label?.trim().slice(0, 80) || "AI agent",
    token_hash: hashReportToken(token),
    token_prefix: token.slice(0, 18),
    scopes: ["reports:read"],
  }).select("id,token_prefix,scopes,created_at").single();
  if (error) throw error;
  return { token, record: data };
}

export async function authenticateReportToken(supabase: SupabaseClient, token: string) {
  if (!token.startsWith("fc_reports_")) return null;
  const { data } = await supabase.from("report_access_tokens").select("id,user_id,scopes,expires_at,revoked_at").eq("token_hash", hashReportToken(token)).is("revoked_at", null).maybeSingle();
  if (!data || !data.scopes?.includes("reports:read")) return null;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return null;
  await supabase.from("report_access_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data as { id: string; user_id: string; scopes: string[] };
}
