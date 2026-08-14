import { NextResponse } from "next/server";
import { runResearchScan } from "@/lib/research/run-scan";
import { ensureNicheAutoScan } from "@/lib/research/ensure-niche-auto-scan";
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
  // Self-heal older niche scans when a new live provider (notably Instagram)
  // is configured after the profile was first saved.
  const { data: autoScanUsers, error: autoScanUsersError } = await admin
    .from("research_scans")
    .select("user_id")
    .eq("auto_scan_enabled", true)
    .limit(1000);
  if (autoScanUsersError) {
    return NextResponse.json(
      { error: autoScanUsersError.message },
      { status: 500 },
    );
  }
  const userIds = Array.from(
    new Set((autoScanUsers ?? []).map((row) => row.user_id)),
  );
  await Promise.all(
    userIds.map((userId) => ensureNicheAutoScan({ supabase: admin, userId })),
  );

  const { data: scans, error } = await admin
    .from("research_scans")
    .select("id, user_id")
    .eq("auto_scan_enabled", true)
    .in("status", ["active", "needs_attention"])
    .or(`next_run_at.is.null,next_run_at.lte.${new Date().toISOString()}`)
    .limit(25);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const scan of scans ?? []) {
    try {
      const result = await runResearchScan({
        supabase: admin,
        userId: scan.user_id,
        scanId: scan.id,
        maxCreatorTargets: 50,
      });
      results.push({ scanId: scan.id, ok: true, ...result });
    } catch (scanError) {
      results.push({
        scanId: scan.id,
        ok: false,
        error:
          scanError instanceof Error ? scanError.message : "Scan failed",
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
