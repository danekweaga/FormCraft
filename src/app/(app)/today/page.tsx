import Link from "next/link";
import { redirect } from "next/navigation";
import { IntelligenceExplanation } from "@/components/intelligence/intelligence-explanation";
import { PageHeader } from "@/components/layout/page-header";
import { MaterialIcon } from "@/components/layout/material-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildTodaySignals } from "@/lib/social/today-signals";
import {
  buildTodayPriorities,
  recommendNextContent,
} from "@/lib/intelligence/today-priority";
import { detectRoadmapBottleneck } from "@/lib/intelligence/roadmap-bottleneck";
import { createClient } from "@/lib/supabase/server";
import { summarizeAccountPerformance } from "@/lib/my-content/performance";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import { filterPostsByPerformanceRange } from "@/lib/my-content/dashboard";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: connections } = await supabase
    .from("social_connections")
    .select(
      "id, platform, status, last_successful_sync_at, last_error, sync_frequency_hours, username",
    )
    .eq("user_id", user.id)
    .eq("account_type", "owned")
    .neq("status", "disconnected");

  const { data: recentSynced } = await supabase
    .from("content_posts")
    .select("id, title, caption, metrics_refreshed_at, views, platform")
    .eq("user_id", user.id)
    .eq("source", "connected_account")
    .not("metrics_refreshed_at", "is", null)
    .order("metrics_refreshed_at", { ascending: false })
    .limit(5);

  const { data: accountPosts } = await supabase
    .from("content_posts")
    .select(
      "id, platform, source, source_label, title, caption, published_at, views, reach, likes, comments, shares, saves, followers_gained, is_winner, needs_review, relative_performance, created_at, metrics_refreshed_at",
    )
    .eq("user_id", user.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(180);

  const { data: experiments } = await supabase
    .from("content_experiments")
    .select("id, hypothesis, post_ids, metrics, status")
    .eq("user_id", user.id)
    .eq("status", "running")
    .limit(10);

  const { data: weekly } = await supabase
    .from("content_weekly_reports")
    .select("id, week_start")
    .eq("user_id", user.id)
    .order("week_start", { ascending: false })
    .limit(1);

  const signals = buildTodaySignals({
    connections: connections ?? [],
    recentSynced: recentSynced ?? [],
    experiments: experiments ?? [],
    hasWeeklyReport: Boolean(weekly?.[0]),
  });

  const [priorities, nextContent, bottleneck] = await Promise.all([
    buildTodayPriorities({ supabase, userId: user.id }),
    recommendNextContent({ supabase, userId: user.id }),
    detectRoadmapBottleneck({ supabase, userId: user.id }),
  ]);

  const top = priorities[0];
  const accountSummary = summarizeAccountPerformance(
    filterPostsByPerformanceRange(
      (accountPosts ?? []) as ContentPostRow[],
      "30",
    ),
  );

  return (
    <div>
      <PageHeader
        title="Today"
        description="Priority from your roadmap, experiments, backlog, and synced Instagram performance — not generic idea spam."
      />

      <div className="mb-6">
        <IntelligenceExplanation
          title="Today's priority"
          recommendation={top?.title ?? nextContent.recommendedConcept}
          why={top?.why ?? nextContent.whyNow}
          evidence={bottleneck.evidence}
          confidence={bottleneck.confidence}
          sources={[
            "Roadmap bottleneck engine",
            "Active experiments",
            "Idea Gate backlog",
            "My Content winners",
          ]}
          suggestedAction={
            top?.estimatedMinutes
              ? `Estimated effort: ${top.estimatedMinutes} minutes`
              : nextContent.suggestedHookDirection
          }
          links={[
            { label: "Open roadmap", href: "/roadmap" },
            { label: "Open experiments", href: "/experiments" },
            { label: "Idea Gate", href: "/idea-gate" },
          ]}
        />
      </div>

      <Card className="mb-6 border-outline-variant/20 bg-surface-primary paper-shadow">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>30-day account pulse</CardTitle>
              <CardDescription>
                Current totals for content published in the last 30 days.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/performance?range=30">Full analytics</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Posts", accountSummary.postCount.toLocaleString()],
              ["Views", accountSummary.totalViews?.toLocaleString() ?? "Unavailable"],
              ["Reach", accountSummary.totalReach?.toLocaleString() ?? "Unavailable"],
              [
                "Engagement rate",
                accountSummary.engagementRate
                  ? `${accountSummary.engagementRate.value.toFixed(2)}%`
                  : "Unavailable",
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-surface-container-lowest p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{label}</p>
                <p className="mt-2 font-headline text-xl font-bold text-on-background">{value}</p>
              </div>
            ))}
          </div>
          {accountSummary.topByViews ? (
            <Link
              href={`/my-content/${accountSummary.topByViews.id}`}
              className="mt-4 block rounded-lg border border-outline-variant/15 p-4 hover:bg-surface-container-low"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Best-performing video</p>
              <p className="mt-1 font-semibold text-on-background">
                {accountSummary.topByViews.title || accountSummary.topByViews.caption?.slice(0, 80) || "Untitled"}
              </p>
              <p className="mt-1 text-sm text-secondary">
                {accountSummary.topByViews.views?.toLocaleString() ?? "Unavailable"} views
              </p>
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Next content recommendation</CardTitle>
            <CardDescription>
              Deterministic ranking with optional LLM later — never invents metrics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-semibold text-on-background">
              {nextContent.recommendedConcept}
            </p>
            <p className="text-secondary">
              Hook direction: {nextContent.suggestedHookDirection}
            </p>
            <p className="text-secondary">
              Format: {nextContent.suggestedFormat}
            </p>
            {nextContent.alternatives.length > 0 ? (
              <ul className="list-disc pl-5 text-secondary">
                {nextContent.alternatives.map((alt) => (
                  <li key={alt}>{alt}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MaterialIcon
                name="flag"
                className="text-primary-container"
                filled
              />
              <CardTitle>Connection signals</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {signals.length === 0 ? (
              <EmptyState
                title="No connection alerts"
                description="Sync Instagram from Connections to surface freshness nudges."
                action={
                  <Button asChild>
                    <Link href="/connections">Open Connections</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-3">
                {signals.map((signal) => (
                  <li key={`${signal.title}-${signal.href}`}>
                    <Link
                      href={signal.href}
                      className="block rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4"
                    >
                      <p className="text-sm font-semibold text-on-background">
                        {signal.title}
                      </p>
                      <p className="mt-1 text-sm text-secondary">
                        {signal.detail}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
