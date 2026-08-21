import { NextResponse } from "next/server";
import { reportToMarkdown } from "@/lib/reports/export";
import type { ReportResult } from "@/lib/reports/types";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabase.from("report_runs").select("result,report_type,created_at").eq("id", runId).eq("user_id", user.id).single();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const format = new URL(request.url).searchParams.get("format");
  const filename = `${data.report_type}-${data.created_at.slice(0, 10)}`;
  if (format === "json") return new NextResponse(JSON.stringify(data.result, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${filename}.json"` } });
  return new NextResponse(reportToMarkdown(data.result as ReportResult), { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${filename}.md"` } });
}
