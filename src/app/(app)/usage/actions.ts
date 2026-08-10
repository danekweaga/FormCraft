"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function authenticated() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

export async function refreshDataHealthAction() {
  const { supabase, user } = await authenticated();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [aiJobs, syncJobs, connections, scans] = await Promise.all([
    supabase.from("ai_jobs").select("id, job_type, error_message, created_at").eq("user_id", user.id).in("status", ["failed", "rate_limited", "budget_blocked"]).gte("created_at", since).limit(20),
    supabase.from("social_sync_jobs").select("id, error_message, created_at").eq("user_id", user.id).eq("status", "failed").gte("created_at", since).limit(20),
    supabase.from("social_connections").select("id, platform, username, status, last_error, last_successful_sync_at, auto_sync_enabled").eq("user_id", user.id).eq("account_type", "owned"),
    supabase.from("research_scans").select("id, name, status, last_error").eq("user_id", user.id).eq("status", "needs_attention"),
  ]);

  const alerts: Array<Record<string, unknown>> = [];
  for (const job of aiJobs.data ?? []) alerts.push({ user_id: user.id, kind: "ai_job", title: `AI task needs attention: ${job.job_type}`, body: job.error_message || "The task did not complete.", href: "/usage", dedupe_key: `ai-job:${job.id}`, metadata: { jobId: job.id } });
  for (const job of syncJobs.data ?? []) alerts.push({ user_id: user.id, kind: "social_sync", title: "A social sync failed", body: job.error_message || "Open Connections to retry the sync.", href: "/connections", dedupe_key: `sync-job:${job.id}`, metadata: { jobId: job.id } });
  for (const connection of connections.data ?? []) {
    const stale = connection.auto_sync_enabled && (!connection.last_successful_sync_at || Date.now() - new Date(connection.last_successful_sync_at).getTime() > 36 * 60 * 60 * 1000);
    if (connection.status === "needs_attention" || connection.last_error || stale) alerts.push({ user_id: user.id, kind: "connection", title: `${connection.platform} connection needs attention`, body: connection.last_error || (stale ? "No successful sync in the last 36 hours." : "Review the connection."), href: "/connections", dedupe_key: `connection:${connection.id}:${connection.last_error ? "error" : "stale"}`, metadata: { connectionId: connection.id } });
  }
  for (const scan of scans.data ?? []) alerts.push({ user_id: user.id, kind: "research_scan", title: `Research scan needs attention: ${scan.name}`, body: scan.last_error || "The scan could not run.", href: "/research", dedupe_key: `research-scan:${scan.id}`, metadata: { scanId: scan.id } });

  if (alerts.length) await supabase.from("notification_events").upsert(alerts, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
  revalidatePath("/usage");
  redirect(`/usage?refreshed=${alerts.length}#notifications`);
}

export async function markNotificationsReadAction() {
  const { supabase, user } = await authenticated();
  await supabase.from("notification_events").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/usage");
}
