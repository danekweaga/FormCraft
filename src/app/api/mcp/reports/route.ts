import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateReportToken } from "@/lib/reports/access-tokens";
import { compareReports } from "@/lib/reports/compare";
import type { ReportResult } from "@/lib/reports/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const requestSchema = z.object({
  tool: z.enum(["list_reports", "get_report", "get_latest_report", "search_reports", "compare_reports", "get_report_evidence"]),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

function bearer(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export async function POST(request: Request) {
  const admin = createAdminClient();
  const access = await authenticateReportToken(admin, bearer(request));
  if (!access) return NextResponse.json({ error: "Invalid reports:read token" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid read-only report tool request" }, { status: 400 });
  const args = parsed.data.arguments;

  if (parsed.data.tool === "list_reports") {
    const { data, error } = await admin.from("report_runs").select("id,report_type,status,confidence,period_start,period_end,generated_at,created_at").eq("user_id", access.user_id).order("created_at", { ascending: false }).limit(Math.min(Number(args.limit ?? 50), 100));
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ reports: data ?? [] });
  }

  if (parsed.data.tool === "get_report" || parsed.data.tool === "get_latest_report") {
    let query = admin.from("report_runs").select("id,report_type,status,confidence,period_start,period_end,result,metrics_used,generated_at,created_at").eq("user_id", access.user_id).in("status", ["ready", "partial"]);
    query = parsed.data.tool === "get_report" ? query.eq("id", String(args.reportId ?? "")) : query.eq("report_type", String(args.reportType ?? "content_strategy_audit")).order("created_at", { ascending: false }).limit(1);
    const { data, error } = await query.maybeSingle();
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ report: data });
  }

  if (parsed.data.tool === "search_reports") {
    const query = String(args.query ?? "").trim().toLowerCase();
    const { data, error } = await admin.from("report_runs").select("id,report_type,status,confidence,result,generated_at,created_at").eq("user_id", access.user_id).in("status", ["ready", "partial"]).order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const matches = (data ?? []).filter((row) => JSON.stringify(row.result).toLowerCase().includes(query)).slice(0, Math.min(Number(args.limit ?? 20), 50));
    return NextResponse.json({ reports: matches });
  }

  if (parsed.data.tool === "compare_reports") {
    const ids = [String(args.beforeReportId ?? ""), String(args.afterReportId ?? "")];
    const { data, error } = await admin.from("report_runs").select("id,result,created_at").eq("user_id", access.user_id).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const before = data?.find((row) => row.id === ids[0]);
    const after = data?.find((row) => row.id === ids[1]);
    if (!before || !after) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json({ comparison: compareReports(before.result as ReportResult, after.result as ReportResult) });
  }

  const reportId = String(args.reportId ?? "");
  const { data, error } = await admin.from("report_run_evidence").select("finding_id,direction,source_type,source_id,label,excerpt,metrics,href,created_at").eq("user_id", access.user_id).eq("report_run_id", reportId).limit(500);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ evidence: data ?? [] });
}
