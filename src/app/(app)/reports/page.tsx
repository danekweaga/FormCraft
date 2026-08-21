import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureDefaultReportDefinitions } from "@/lib/reports/definitions";
import { REPORT_TEMPLATES } from "@/lib/reports/templates";
import type { ReportRunRow } from "@/lib/reports/types";
import { createClient } from "@/lib/supabase/server";
import { runReportAction, updateReportScheduleAction } from "./actions";
import { ReportAccessPanel } from "./report-access-panel";

const tabs = ["overview", "all", "scheduled", "history"] as const;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const params = await searchParams;
  const tab = tabs.includes(params.tab as (typeof tabs)[number]) ? params.tab! : "overview";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/reports");
  const definitions = await ensureDefaultReportDefinitions(supabase, user.id);
  const [{ data: runs }, { data: schedules }] = await Promise.all([
    supabase.from("report_runs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(80),
    supabase.from("report_schedules").select("*").eq("user_id", user.id),
  ]);
  const typedRuns = (runs ?? []) as ReportRunRow[];
  const query = params.q?.trim().toLowerCase();
  const shownRuns = query ? typedRuns.filter((run) => JSON.stringify(run.result).toLowerCase().includes(query) || run.report_type.includes(query)) : typedRuns;
  const flagship = definitions.find((definition) => definition.report_type === "content_strategy_audit")!;

  return (
    <div>
      <PageHeader title="Reports" description="Deep content intelligence with transparent evidence, counterexamples, data quality, and actions you can take next." actions={<Button asChild variant="outline"><Link href="/reports?tab=history">Run history</Link></Button>} />
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Report sections">
        {tabs.map((item) => <Button key={item} asChild size="sm" variant={tab === item ? "primary" : "outline"}><Link href={`/reports?tab=${item}`}>{item === "all" ? "All Reports" : item[0]!.toUpperCase() + item.slice(1)}</Link></Button>)}
      </nav>

      {tab === "overview" ? (
        <div className="space-y-6">
          <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-surface-primary to-tertiary/10">
            <CardHeader><div className="mb-2 flex gap-2"><Badge variant="primary">Recommended</Badge><Badge variant="default">STANDARD model</Badge></div><CardTitle>Content Strategy Audit</CardTitle><CardDescription>Analyze the last 10, 20, or 30 posts—or a date range—across topics, hooks, formats, audience signals, experiments, and strategy.</CardDescription></CardHeader>
            <CardContent>
              <form action={runReportAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_180px_180px_auto]">
                <input type="hidden" name="definitionId" value={flagship.id} />
                <select name="window" defaultValue="last-20" className="h-11 rounded-xl border border-outline-variant/40 bg-surface-primary px-4"><option value="last-10">Last 10 posts</option><option value="last-20">Last 20 posts</option><option value="last-30">Last 30 posts</option><option value="days-30">Last 30 days</option><option value="days-90">Last 90 days</option><option value="custom">Custom dates</option></select>
                <input aria-label="Custom start date" type="date" name="start" className="h-11 rounded-xl border border-outline-variant/40 bg-surface-primary px-3" />
                <input aria-label="Custom end date" type="date" name="end" className="h-11 rounded-xl border border-outline-variant/40 bg-surface-primary px-3" />
                <Button type="submit" variant="primary">Run strategy audit</Button>
              </form>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {REPORT_TEMPLATES.filter((template) => !template.recommended).slice(0, 6).map((template) => {
              const definition = definitions.find((item) => item.report_type === template.type)!;
              const defaultWindow = template.defaultWindow.kind === "last_posts" ? `last-${template.defaultWindow.count}` : template.defaultWindow.kind === "last_days" ? `days-${template.defaultWindow.days}` : "last-20";
              return <Card key={template.type}><CardHeader><CardTitle className="text-lg">{template.name}</CardTitle><CardDescription>{template.description}</CardDescription></CardHeader><CardContent><form action={runReportAction}><input type="hidden" name="definitionId" value={definition.id} /><input type="hidden" name="window" value={defaultWindow} /><Button size="sm" type="submit" variant="outline">Run report</Button></form></CardContent></Card>;
            })}
          </div>
          <RunList runs={typedRuns.slice(0, 6)} title="Recent reports" />
        </div>
      ) : null}

      {tab === "all" ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{REPORT_TEMPLATES.map((template) => { const definition = definitions.find((item) => item.report_type === template.type)!; return <Card key={template.type}><CardHeader><CardTitle className="text-lg">{template.name}</CardTitle><CardDescription>{template.description}</CardDescription></CardHeader><CardContent><form action={runReportAction} className="space-y-3"><input type="hidden" name="definitionId" value={definition.id} /><select name="window" defaultValue="last-20" className="h-10 w-full rounded-lg border border-outline-variant/40 bg-surface-primary px-3 text-sm"><option value="last-10">Last 10 posts</option><option value="last-20">Last 20 posts</option><option value="last-30">Last 30 posts</option><option value="days-30">Last 30 days</option><option value="days-90">Last 90 days</option></select><Button size="sm" type="submit">Run</Button></form></CardContent></Card>; })}</div> : null}

      {tab === "scheduled" ? <div className="space-y-4"><div className="grid gap-4 lg:grid-cols-2">{definitions.map((definition) => { const schedule = schedules?.find((item) => item.report_definition_id === definition.id); return <Card key={definition.id}><CardHeader><CardTitle className="text-lg">{definition.name}</CardTitle><CardDescription>{schedule?.next_run_at ? `Next run ${new Date(schedule.next_run_at).toLocaleString()}` : "No automatic run scheduled."}</CardDescription></CardHeader><CardContent><form action={updateReportScheduleAction} className="flex flex-wrap items-center gap-3"><input type="hidden" name="definitionId" value={definition.id} /><select name="frequency" defaultValue={schedule?.frequency ?? "manual"} className="h-10 rounded-lg border border-outline-variant/40 bg-surface-primary px-3"><option value="manual">Manual</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="emailEnabled" defaultChecked={schedule?.email_enabled ?? false} /> Email ready report</label><Button size="sm" type="submit">Save schedule</Button></form></CardContent></Card>; })}</div><ReportAccessPanel /></div> : null}

      {tab === "history" ? <div className="space-y-4"><form className="flex gap-2"><input type="hidden" name="tab" value="history" /><input name="q" defaultValue={params.q} placeholder="Search report findings…" className="h-11 flex-1 rounded-xl border border-outline-variant/40 bg-surface-primary px-4" /><Button type="submit" variant="outline">Search</Button></form><RunList runs={shownRuns} title="Run history" /></div> : null}
    </div>
  );
}

function RunList({ runs, title }: { runs: ReportRunRow[]; title: string }) {
  return <section><h2 className="mb-3 text-xl font-semibold">{title}</h2><div className="space-y-3">{runs.length ? runs.map((run) => <Link key={run.id} href={`/reports/${run.id}`} className="flex flex-col gap-2 rounded-xl border border-outline-variant/25 bg-surface-primary p-4 transition hover:border-primary/40 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{(run.result as { title?: string }).title ?? run.report_type.replaceAll("_", " ")}</p><p className="text-sm text-secondary">{new Date(run.created_at).toLocaleString()} · {(run.data_window as { kind?: string }).kind ?? "window"}</p></div><div className="flex items-center gap-2"><Badge variant={run.status === "ready" ? "primary" : "default"}>{run.status.replaceAll("_", " ")}</Badge>{run.confidence ? <Badge variant="default">{run.confidence} confidence</Badge> : null}</div></Link>) : <p className="rounded-xl border border-dashed border-outline-variant/40 p-8 text-center text-secondary">No reports yet.</p>}</div></section>;
}
