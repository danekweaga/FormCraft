import { NextResponse } from "next/server";
import { runWatchlistMonitor } from "@/lib/research/watchlist-monitor";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: users, error } = await admin
    .from("research_watchlists")
    .select("user_id")
    .eq("paused", false)
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = Array.from(new Set((users ?? []).map((row) => row.user_id)));
  const results = [];
  for (const userId of userIds.slice(0, 25)) {
    try {
      const result = await runWatchlistMonitor({
        supabase: admin,
        userId,
        maxCreators: 40,
      });
      results.push({ userId, ok: true, ...result });
    } catch (monitorError) {
      results.push({
        userId,
        ok: false,
        error:
          monitorError instanceof Error
            ? monitorError.message
            : "Watchlist monitor failed",
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
