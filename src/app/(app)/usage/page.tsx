import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAiBudgets, getSpendSince } from "@/lib/ai/budget";
import { createClient } from "@/lib/supabase/server";
import { markNotificationsReadAction, refreshDataHealthAction } from "./actions";

type PageProps = { searchParams: Promise<{ refreshed?: string }> };

function usd(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value); }
function percent(value: number, total: number) { return total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0; }

export default async function UsagePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const budgets = getAiBudgets();
  const [dailySpend, monthlySpend, aiUsage, providerUsage, aiJobs, syncJobs, connections, scans, notifications] = await Promise.all([
    getSpendSince(supabase, user.id, startOfDay.toISOString()),
    getSpendSince(supabase, user.id, startOfMonth.toISOString()),
    supabase.from("ai_usage_events").select("id, task_type, model_tier, model_name, cost_usd, estimated_cost_usd, created_at").eq("user_id", user.id).gte("created_at", startOfMonth.toISOString()).order("created_at", { ascending: false }).limit(100),
    supabase.from("provider_usage_events").select("id, provider, operation, result_count, cost_usd, created_at").eq("user_id", user.id).gte("created_at", startOfMonth.toISOString()).order("created_at", { ascending: false }).limit(100),
    supabase.from("ai_jobs").select("id, job_type, model, status, cached, error_message, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("social_sync_jobs").select("id, sync_type, status, records_found, records_created, error_message, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("social_connections").select("id, platform, username, status, last_successful_sync_at, last_error, auto_sync_enabled").eq("user_id", user.id).eq("account_type", "owned"),
    supabase.from("research_scans").select("id, name, status, last_run_at, last_error").eq("user_id", user.id),
    supabase.from("notification_events").select("id, kind, title, body, href, read_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);

  const failedAi = (aiJobs.data ?? []).filter((job) => ["failed", "rate_limited", "budget_blocked"].includes(job.status));
  const failedSyncs = (syncJobs.data ?? []).filter((job) => job.status === "failed");
  const healthyConnections = (connections.data ?? []).filter((connection) => connection.status === "connected" && !connection.last_error);
  const cachedJobs = (aiJobs.data ?? []).filter((job) => job.cached).length;
  const unread = (notifications.data ?? []).filter((item) => !item.read_at).length;

  return (
    <div className="space-y-8">
      <PageHeader title="Usage & Data Health" description="See actual AI/provider spend, automation activity, connection freshness, and failures—without exposing credentials." actions={<form action={refreshDataHealthAction}><Button type="submit">Refresh health</Button></form>} />
      {params.refreshed ? <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">Health check completed. {params.refreshed} actionable alert records found.</p> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><CardDescription>AI today</CardDescription><CardTitle>{usd(dailySpend)}</CardTitle></CardHeader><CardContent><div className="h-2 overflow-hidden rounded-full bg-surface-container"><div className="h-full bg-primary" style={{ width: `${percent(dailySpend, budgets.dailyUsd)}%` }} /></div><p className="mt-2 text-xs text-secondary">{percent(dailySpend, budgets.dailyUsd)}% of {usd(budgets.dailyUsd)}</p></CardContent></Card>
        <Card><CardHeader><CardDescription>AI this month</CardDescription><CardTitle>{usd(monthlySpend)}</CardTitle></CardHeader><CardContent><div className="h-2 overflow-hidden rounded-full bg-surface-container"><div className="h-full bg-primary" style={{ width: `${percent(monthlySpend, budgets.monthlyUsd)}%` }} /></div><p className="mt-2 text-xs text-secondary">{percent(monthlySpend, budgets.monthlyUsd)}% of {usd(budgets.monthlyUsd)}</p></CardContent></Card>
        <Card><CardHeader><CardDescription>Connected accounts</CardDescription><CardTitle>{healthyConnections.length}/{connections.data?.length ?? 0}</CardTitle></CardHeader><CardContent><p className="text-xs text-secondary">Healthy owned-account connections</p></CardContent></Card>
        <Card><CardHeader><CardDescription>Recent failures</CardDescription><CardTitle>{failedAi.length + failedSyncs.length}</CardTitle></CardHeader><CardContent><p className="text-xs text-secondary">Across the latest 50 AI and sync jobs</p></CardContent></Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>AI operations</CardTitle><CardDescription>Real recorded jobs. Cached jobs avoided another model call.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2"><Badge variant="primary">{aiUsage.data?.length ?? 0} usage events this month</Badge><Badge variant="default">{cachedJobs} cached</Badge></div>
            {(aiJobs.data?.length ?? 0) === 0 ? <p className="text-sm text-secondary">No AI jobs recorded.</p> : <ul className="divide-y divide-outline-variant/15">{aiJobs.data?.slice(0, 10).map((job) => <li key={job.id} className="flex items-start justify-between gap-3 py-3"><div><p className="font-medium">{job.job_type.replaceAll("_", " ")}</p><p className="text-xs text-secondary">{job.model || "Fallback/no model recorded"}{job.error_message ? ` · ${job.error_message}` : ""}</p></div><Badge variant={job.status === "completed" ? "primary" : "default"}>{job.cached ? "cached" : job.status}</Badge></li>)}</ul>}
            <Button asChild variant="outline" size="sm"><Link href="/models">Choose models by task</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>External providers</CardTitle><CardDescription>Discovery/API calls recorded separately from AI generation.</CardDescription></CardHeader>
          <CardContent>
            {(providerUsage.data?.length ?? 0) === 0 ? <p className="text-sm text-secondary">No external provider events recorded this month.</p> : <ul className="divide-y divide-outline-variant/15">{providerUsage.data?.slice(0, 12).map((event) => <li key={event.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium">{event.provider}</p><p className="text-xs text-secondary">{event.operation.replaceAll("_", " ")} · {event.result_count} results</p></div><span className="text-sm">{event.cost_usd == null ? "Cost not reported" : usd(Number(event.cost_usd))}</span></li>)}</ul>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Connection & sync health</CardTitle><CardDescription>Freshness for owned accounts and scheduled imports.</CardDescription></CardHeader><CardContent className="space-y-3">{(connections.data?.length ?? 0) === 0 ? <p className="text-sm text-secondary">No accounts connected.</p> : connections.data?.map((connection) => <div key={connection.id} className="rounded-lg border border-outline-variant/15 p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium capitalize">{connection.platform} {connection.username ? `· @${connection.username}` : ""}</p><Badge variant={connection.status === "connected" && !connection.last_error ? "primary" : "default"}>{connection.status}</Badge></div><p className="mt-1 text-xs text-secondary">Last successful sync: {connection.last_successful_sync_at ? new Date(connection.last_successful_sync_at).toLocaleString() : "Never"}</p>{connection.last_error ? <p className="mt-1 text-xs text-error">{connection.last_error}</p> : null}</div>)}<Button asChild variant="outline" size="sm"><Link href="/connections">Manage connections</Link></Button></CardContent></Card>
        <Card><CardHeader><CardTitle>Research automation</CardTitle><CardDescription>Saved scans and their latest health state.</CardDescription></CardHeader><CardContent>{(scans.data?.length ?? 0) === 0 ? <p className="text-sm text-secondary">No recurring research scans configured.</p> : <ul className="divide-y divide-outline-variant/15">{scans.data?.map((scan) => <li key={scan.id} className="flex items-start justify-between gap-3 py-3"><div><p className="font-medium">{scan.name}</p><p className="text-xs text-secondary">Last run: {scan.last_run_at ? new Date(scan.last_run_at).toLocaleString() : "Never"}{scan.last_error ? ` · ${scan.last_error}` : ""}</p></div><Badge variant={scan.status === "active" ? "primary" : "default"}>{scan.status}</Badge></li>)}</ul>}</CardContent></Card>
      </section>

      <section id="notifications">
        <Card>
          <CardHeader className="flex-row items-start justify-between"><div><CardTitle>Notification center</CardTitle><CardDescription>Operational issues only—failed jobs, stale syncs, and scans that need attention.</CardDescription></div>{unread ? <form action={markNotificationsReadAction}><Button type="submit" variant="ghost" size="sm">Mark all read</Button></form> : null}</CardHeader>
          <CardContent>{(notifications.data?.length ?? 0) === 0 ? <p className="text-sm text-secondary">No operational alerts. Run Refresh health to check current state.</p> : <ul className="divide-y divide-outline-variant/15">{notifications.data?.map((item) => <li key={item.id} className="py-3"><Link href={item.href || "/usage"} className="flex items-start justify-between gap-4"><div><p className={item.read_at ? "font-medium text-secondary" : "font-semibold"}>{item.title}</p>{item.body ? <p className="mt-1 text-sm text-secondary">{item.body}</p> : null}</div>{!item.read_at ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}</Link></li>)}</ul>}</CardContent>
        </Card>
      </section>
    </div>
  );
}
