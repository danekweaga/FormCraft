import { NextResponse } from "next/server";
import { runSocialSync } from "@/lib/social/sync/run-sync";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const dueBefore = new Date().toISOString();
  const { data: connections, error } = await admin
    .from("social_connections")
    .select("id, user_id, platform")
    .eq("account_type", "owned")
    .eq("status", "connected")
    .eq("auto_sync_enabled", true)
    .or(`next_scheduled_sync_at.is.null,next_scheduled_sync_at.lte.${dueBefore}`)
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<Record<string, unknown>> = [];
  for (const connection of connections ?? []) {
    try {
      const result = await runSocialSync({ userId: connection.user_id, connectionId: connection.id, syncType: "incremental_sync" });
      results.push({ connectionId: connection.id, platform: connection.platform, ok: true, jobId: result.jobId });
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "Social sync failed";
      results.push({ connectionId: connection.id, platform: connection.platform, ok: false, error: message });
      await admin.from("notification_events").upsert({
        user_id: connection.user_id,
        kind: "social_sync",
        title: `${connection.platform} automatic sync failed`,
        body: message.slice(0, 500),
        href: "/connections",
        dedupe_key: `automatic-sync:${connection.id}:${new Date().toISOString().slice(0, 10)}`,
        metadata: { connectionId: connection.id },
      }, { onConflict: "user_id,dedupe_key" });
    }
  }
  return NextResponse.json({ processed: results.length, results });
}
