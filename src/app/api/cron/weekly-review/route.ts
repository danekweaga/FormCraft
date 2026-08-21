import { NextResponse } from "next/server";
import { generateWeeklyReview } from "@/lib/intelligence/weekly-review";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDueReportSchedules } from "@/lib/reports/scheduler";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const reportResults = await processDueReportSchedules(admin);
  const isSunday = new Date().getUTCDay() === 0;
  if (!isSunday) {
    return NextResponse.json({ processed: 0, results: [], scheduledReports: reportResults });
  }
  const { data: rows, error } = await admin.from("social_connections").select("user_id").eq("account_type", "owned").neq("status", "disconnected").limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const userIds = Array.from(new Set((rows ?? []).map((row) => row.user_id))).slice(0, 15);
  const results: Array<Record<string, unknown>> = [];
  for (const userId of userIds) {
    try {
      const review = await generateWeeklyReview({ supabase: admin, userId });
      results.push({ userId, ok: true, usedLlm: review.usedLlm });
      await admin.from("notification_events").upsert({
        user_id: userId,
        kind: "weekly_review",
        title: "Your weekly creator review is ready",
        body: review.review.performanceSummary,
        href: "/dashboard",
        dedupe_key: `weekly-review:${new Date().toISOString().slice(0, 10)}`,
        metadata: { confidence: review.review.confidence },
      }, { onConflict: "user_id,dedupe_key" });
    } catch (reviewError) {
      results.push({ userId, ok: false, error: reviewError instanceof Error ? reviewError.message : "Weekly review failed" });
    }
  }
  return NextResponse.json({ processed: results.length, results, scheduledReports: reportResults });
}
