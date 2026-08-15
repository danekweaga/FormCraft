import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAiBudgetStatus } from "@/lib/ai/budget";
import { isLlmConfigured } from "@/lib/ai/models/router";
import { DEFAULT_OPENROUTER_MODELS } from "@/lib/ai/models/router";
import { getInstagramAccountInsights } from "@/lib/social/instagram-account-insights";
import { createClient } from "@/lib/supabase/server";

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export default async function DiagnosticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const keyConfigured = isLlmConfigured();
  const budget = await getAiBudgetStatus(supabase, user.id);

  const [
    recentUsage,
    connections,
    postSnapshotCount,
    accountSnapshotCount,
    contentPostCount,
  ] = await Promise.all([
    supabase
      .from("ai_usage_events")
      .select(
        "id, task_type, model_name, model_tier, cost_usd, estimated_cost_usd, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("social_connections")
      .select(
        "id, platform, username, status, last_successful_sync_at, last_error, auto_sync_enabled, metadata",
      )
      .eq("user_id", user.id)
      .eq("account_type", "owned"),
    supabase
      .from("content_metric_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("account_metric_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("content_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const modelCounts = new Map<string, number>();
  for (const row of recentUsage.data ?? []) {
    const name = row.model_name || "unknown";
    modelCounts.set(name, (modelCounts.get(name) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Diagnostics"
        description="Plain answers for why AI, graphs, or sync might look broken — no credentials exposed."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">Back to Settings</Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>OpenRouter key</CardDescription>
            <CardTitle>{keyConfigured ? "Configured" : "Missing"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={keyConfigured ? "success" : "warning"}>
              {keyConfigured ? "OPENROUTER_API_KEY set" : "Set key in Vercel env"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>AI budget today</CardDescription>
            <CardTitle>
              {usd(budget.dailySpend)} / {usd(budget.dailyBudget)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-secondary">
              Remaining {usd(budget.dailyRemaining)}
              {budget.blocked === "daily" ? " · BLOCKED" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>AI budget this month</CardDescription>
            <CardTitle>
              {usd(budget.monthlySpend)} / {usd(budget.monthlyBudget)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-secondary">
              Remaining {usd(budget.monthlyRemaining)}
              {budget.blocked === "monthly" ? " · BLOCKED" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Owned posts</CardDescription>
            <CardTitle>{contentPostCount.count ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-secondary">
              Post snapshots: {postSnapshotCount.count ?? 0} · Account snapshots:{" "}
              {accountSnapshotCount.count ?? 0}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>FormCraft model defaults</CardTitle>
          <CardDescription>
            What routing uses when you have no per-task override on Models.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-3">
            <li>
              <span className="font-semibold">Cheap</span>
              <p className="break-all text-xs text-secondary">
                {DEFAULT_OPENROUTER_MODELS.cheap}
              </p>
            </li>
            <li>
              <span className="font-semibold">Standard</span>
              <p className="break-all text-xs text-secondary">
                {DEFAULT_OPENROUTER_MODELS.standard}
              </p>
            </li>
            <li>
              <span className="font-semibold">Premium</span>
              <p className="break-all text-xs text-secondary">
                {DEFAULT_OPENROUTER_MODELS.premium}
              </p>
            </li>
          </ul>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/models">Open Models</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Last 20 AI calls</CardTitle>
          <CardDescription>
            See which models actually ran (DeepSeek / Gemini / Claude), not what
            you assume.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {modelCounts.size > 0 ? (
            <div className="flex flex-wrap gap-2">
              {[...modelCounts.entries()].map(([name, count]) => (
                <Badge key={name} variant="default">
                  {name}: {count}
                </Badge>
              ))}
            </div>
          ) : null}
          {(recentUsage.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-secondary">
              No AI usage events yet. Run Analyze, Canvas AI, or a script build.
            </p>
          ) : (
            <ul className="divide-y divide-outline-variant/15">
              {recentUsage.data?.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-2 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {(row.task_type ?? "unknown").replaceAll("_", " ")}
                    </p>
                    <p className="break-all text-xs text-secondary">
                      {row.model_name ?? "—"} · {row.model_tier ?? "—"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-secondary">
                    <p>
                      {usd(
                        Number(row.cost_usd ?? row.estimated_cost_usd ?? 0) || 0,
                      )}
                    </p>
                    <p>{new Date(row.created_at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Owned connections & Instagram insights</CardTitle>
          <CardDescription>
            Follower graphs need accountInsights in connection metadata (or
            account_metric_snapshots).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(connections.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-secondary">No owned connections.</p>
          ) : (
            connections.data?.map((connection) => {
              const insights = getInstagramAccountInsights(connection.metadata);
              const daily = insights?.daily?.length ?? 0;
              const follows = insights?.totals?.follows ?? null;
              const unfollows = insights?.totals?.unfollows ?? null;
              return (
                <div
                  key={connection.id}
                  className="rounded-lg border border-outline-variant/15 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium capitalize">
                      {connection.platform}
                      {connection.username ? ` · @${connection.username}` : ""}
                    </p>
                    <Badge
                      variant={
                        connection.status === "connected" && !connection.last_error
                          ? "success"
                          : "warning"
                      }
                    >
                      {connection.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-secondary">
                    Last sync:{" "}
                    {connection.last_successful_sync_at
                      ? new Date(
                          connection.last_successful_sync_at,
                        ).toLocaleString()
                      : "Never"}
                    {" · "}
                    Auto-sync: {connection.auto_sync_enabled ? "on" : "off"}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    accountInsights:{" "}
                    {insights
                      ? `yes · ${daily} daily rows · follows ${follows ?? "—"} / unfollows ${unfollows ?? "—"}`
                      : "missing — sync Instagram again"}
                  </p>
                  {connection.last_error ? (
                    <p className="mt-1 text-xs text-error">{connection.last_error}</p>
                  ) : null}
                </div>
              );
            })
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/connections">Manage connections</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
