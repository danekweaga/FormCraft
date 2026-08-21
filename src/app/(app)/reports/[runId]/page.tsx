import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportMetricGroup, ReportResult, ReportRunRow } from "@/lib/reports/types";
import { createClient } from "@/lib/supabase/server";
import { CopyReportButton } from "./copy-report-button";

export default async function ReportRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/reports/${runId}`);
  const { data } = await supabase.from("report_runs").select("*").eq("id", runId).eq("user_id", user.id).single();
  if (!data) notFound();
  const run = data as ReportRunRow;
  const report = run.result as ReportResult;
  if (!report?.version) return <div><PageHeader title="Report run" description="This report is not ready yet." /><Badge variant="default">{run.status}</Badge>{run.error_message ? <p className="mt-4 text-error">{run.error_message}</p> : null}</div>;
  const { data: comparable } = await supabase.from("report_runs").select("id,created_at").eq("user_id", user.id).eq("report_type", run.report_type).in("status", ["ready", "partial"]).neq("id", run.id).order("created_at", { ascending: false }).limit(1);

  return <div className="space-y-6">
    <PageHeader title={report.title} description={report.summary} actions={<><CopyReportButton text={`${report.title}\n\n${report.summary}\n\n${report.recommendedActions.join("\n")}`} /><Button asChild variant="outline"><Link href={`/api/reports/${run.id}/export?format=markdown`}>Export Markdown</Link></Button><Button asChild variant="outline"><Link href={`/api/reports/${run.id}/export?format=json`}>Export JSON</Link></Button>{comparable?.[0] ? <Button asChild><Link href={`/reports/compare?left=${comparable[0].id}&right=${run.id}`}>Compare</Link></Button> : null}</>} />
    <div className="flex flex-wrap gap-2"><Badge variant={run.status === "ready" ? "primary" : "default"}>{run.status}</Badge><Badge variant="default">{report.dataQuality.confidence} confidence</Badge><Badge variant="default">{report.dataQuality.metricsCoveragePct}% metric coverage</Badge><Badge variant="default">{report.dataQuality.freshness} data</Badge><Badge variant="default">model: {run.model ?? "deterministic"}</Badge></div>
    <div className="grid gap-4 md:grid-cols-3"><Stat label="Eligible posts" value={report.dataQuality.eligiblePosts} /><Stat label="Audience comments" value={report.provenance.sourceCounts.comments ?? 0} /><Stat label="Retention available" value={report.dataQuality.retentionAvailable} /></div>
    <RequiredSection title="Observed Data" items={report.observedData} tone="blue" />
    <RequiredSection title="Patterns" items={report.patterns} />
    <RequiredSection title="AI Interpretation" description="Model interpretation is separated from measured facts." items={report.aiInterpretation} tone="purple" />
    <div className="grid gap-5 xl:grid-cols-3"><MetricTable title="Topics" groups={report.topicGroups} /><MetricTable title="Hooks" groups={report.hookGroups} /><MetricTable title="Formats" groups={report.formatGroups} /></div>
    <div className="grid gap-5 lg:grid-cols-2"><RequiredSection title="Contradictory Evidence" items={report.contradictoryEvidence} tone="amber" /><RequiredSection title="What This Report Cannot Conclude" items={report.cannotConclude} tone="red" /></div>
    <Card><CardHeader><CardTitle>Signal Finder</CardTitle><CardDescription>Audience demand × creator interest, with cross-post evidence.</CardDescription></CardHeader><CardContent className="space-y-3">{report.emergingSignals.length ? report.emergingSignals.map((signal) => <div key={signal.id} className="rounded-lg border border-outline-variant/25 p-3"><div className="flex flex-wrap items-center gap-2"><strong>{signal.label}</strong><Badge variant="default">demand: {signal.audienceDemand}</Badge><Badge variant="default">interest: {signal.creatorInterest}</Badge><Badge variant="default">{signal.crossPostEvidence} posts</Badge></div><p className="mt-2 text-sm text-secondary">{signal.recommendation}</p></div>) : <p className="text-secondary">No cross-post signals are available yet.</p>}</CardContent></Card>
    <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>Experiments</CardTitle></CardHeader><CardContent className="space-y-3">{report.experiments.map((experiment) => <div key={experiment.id}><Link href="/experiments" className="font-medium text-primary hover:underline">{experiment.hypothesis}</Link><p className="text-sm text-secondary">{experiment.status} · {experiment.postCount} posts · {experiment.evidenceStrength} evidence. {experiment.uncertainty}</p></div>)}{!report.experiments.length ? <p className="text-secondary">No experiments found.</p> : null}</CardContent></Card><Card><CardHeader><CardTitle>Roadmap + psychology</CardTitle></CardHeader><CardContent className="space-y-3">{report.roadmap.map((item) => <div key={item.id}><Link href="/roadmap" className="font-medium text-primary hover:underline">{item.goal}</Link><p className="text-sm text-secondary">{item.phase} · {item.progressPct}% — {item.suggestion}</p></div>)}{report.psychologyContext.map((item) => <div key={item.id}><Link href="/psychology" className="font-medium text-primary hover:underline">{item.principle}</Link><p className="text-sm text-secondary">{item.application} Limitation: {item.limitation}</p></div>)}</CardContent></Card></div>
    <RequiredSection title="Recommended Actions" items={report.recommendedActions} tone="green" />
    <div className="flex flex-wrap gap-3">{report.actions.map((action) => <Button key={`${action.kind}:${action.href}`} asChild variant="outline"><Link href={action.href}>{action.label}</Link></Button>)}</div>
    <Card><CardHeader><CardTitle>Evidence and provenance</CardTitle><CardDescription>Snapshot {report.provenance.snapshotHash.slice(0, 12)}… · {report.provenance.metricsUsed.join(" · ")}</CardDescription></CardHeader><CardContent className="grid gap-2 md:grid-cols-2">{report.evidence.slice(0, 20).map((item) => <Link key={`${item.sourceType}:${item.sourceId}`} href={item.href ?? "#"} className="rounded-lg border border-outline-variant/20 p-3 hover:border-primary/40"><p className="font-medium">{item.label}</p><p className="text-xs text-secondary">{item.sourceType} · {Object.entries(item.metrics ?? {}).map(([key, value]) => `${key}: ${value ?? "—"}`).join(" · ")}</p></Link>)}</CardContent></Card>
  </div>;
}

function Stat({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-5"><p className="text-sm text-secondary">{label}</p><p className="mt-1 text-3xl font-semibold">{value.toLocaleString()}</p></CardContent></Card>; }

function RequiredSection({ title, description, items, tone }: { title: string; description?: string; items: string[]; tone?: "blue" | "purple" | "amber" | "red" | "green" }) {
  const colors = { blue: "border-blue-500/30", purple: "border-purple-500/30", amber: "border-amber-500/30", red: "border-red-500/30", green: "border-emerald-500/30" };
  return <Card className={tone ? colors[tone] : undefined}><CardHeader><CardTitle>{title}</CardTitle>{description ? <CardDescription>{description}</CardDescription> : null}</CardHeader><CardContent>{items.length ? <ul className="space-y-2">{items.map((item, index) => <li key={`${index}:${item}`} className="flex gap-2"><span aria-hidden>•</span><span className="leading-relaxed text-secondary">{item}</span></li>)}</ul> : <p className="text-secondary">No evidence available.</p>}</CardContent></Card>;
}

function MetricTable({ title, groups }: { title: string; groups: ReportMetricGroup[] }) { return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>Median relative views plus non-view evidence.</CardDescription></CardHeader><CardContent className="space-y-3">{groups.slice(0, 8).map((group) => <div key={group.key} className="border-b border-outline-variant/20 pb-3 last:border-0"><div className="flex items-center justify-between gap-3"><strong>{group.label}</strong><Badge variant={group.medianRelativeViews != null && group.medianRelativeViews >= 1 ? "primary" : "default"}>{group.medianRelativeViews?.toFixed(2) ?? "—"}×</Badge></div><p className="mt-1 text-xs text-secondary">n={group.sampleSize} · shares {group.medianShares ?? "—"} · saves {group.medianSaves ?? "—"} · comments {group.medianComments ?? "—"} · {group.conversationSignal} conversation</p></div>)}</CardContent></Card>; }
