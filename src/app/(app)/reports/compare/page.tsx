import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { compareReports } from "@/lib/reports/compare";
import type { ReportResult } from "@/lib/reports/types";
import { createClient } from "@/lib/supabase/server";

export default async function CompareReportsPage({ searchParams }: { searchParams: Promise<{ left?: string; right?: string }> }) {
  const { left, right } = await searchParams;
  if (!left || !right) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/reports");
  const { data } = await supabase.from("report_runs").select("id,result,created_at").eq("user_id", user.id).in("id", [left, right]);
  const before = data?.find((item) => item.id === left);
  const after = data?.find((item) => item.id === right);
  if (!before || !after) notFound();
  const comparison = compareReports(before.result as ReportResult, after.result as ReportResult);
  return <div><PageHeader title="Compare report runs" description={`${new Date(before.created_at).toLocaleDateString()} → ${new Date(after.created_at).toLocaleDateString()}`} /><div className="grid gap-5 lg:grid-cols-3"><Movement title="Topics" rows={comparison.topicMovement} /><Movement title="Hooks" rows={comparison.hookMovement} /><Movement title="Formats" rows={comparison.formatMovement} /></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>Audience signals</CardTitle></CardHeader><CardContent><p className="font-medium">New</p><ul className="mb-4 list-disc pl-5 text-secondary">{comparison.newAudienceSignals.map((item) => <li key={item}>{item}</li>)}</ul><p className="font-medium">Disappeared</p><ul className="list-disc pl-5 text-secondary">{comparison.disappearedAudienceSignals.map((item) => <li key={item}>{item}</li>)}</ul></CardContent></Card><Card><CardHeader><CardTitle>Strategy change</CardTitle></CardHeader><CardContent className="space-y-2 text-secondary"><p>Experiment count change: {comparison.experimentChange >= 0 ? "+" : ""}{comparison.experimentChange}</p><p>Roadmap progress change: {comparison.roadmapProgressChange >= 0 ? "+" : ""}{comparison.roadmapProgressChange.toFixed(1)} points</p>{comparison.warnings.map((warning) => <p key={warning}>{warning}</p>)}</CardContent></Card></div></div>;
}

function Movement({ title, rows }: { title: string; rows: Array<{ label: string; before: number | null; after: number | null; delta: number | null }> }) { return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-3">{rows.slice(0, 10).map((row) => <div key={row.label} className="flex items-center justify-between gap-3"><span>{row.label}</span><span className={row.delta != null && row.delta >= 0 ? "text-emerald-500" : "text-red-500"}>{row.before?.toFixed(2) ?? "—"}× → {row.after?.toFixed(2) ?? "—"}×</span></div>)}</CardContent></Card>; }
