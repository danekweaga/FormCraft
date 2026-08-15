import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RefreshAllConnectedButton } from "@/app/(app)/connections/connection-actions";
import { ContentRemix } from "@/app/(app)/performance/content-remix";
import { ContentStrategyAudit } from "@/app/(app)/performance/content-strategy-audit";
import { GenerateWeeklyReviewButton } from "@/app/(app)/performance/weekly-actions";
import { MaterialIcon } from "@/components/layout/material-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  aggregateInstagramAccountTotals,
  buildAccountFollowerSeries,
  filterPostsByConnection,
  filterPostsByPreviousRange,
  percentageChange,
} from "@/lib/my-content/account-dashboard";
import {
  buildRemixIngredients,
  filterPostsByPerformanceRange,
  PERFORMANCE_RANGES,
  type PerformanceRange,
} from "@/lib/my-content/dashboard";
import {
  buildGrowthSeries,
  formatCompact,
  snapshotWindowStart,
  type MetricSnapshotRow,
} from "@/lib/my-content/growth-series";
import { summarizeAccountPerformance } from "@/lib/my-content/performance";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import { connectionFollowerCount, formatRelativeTime } from "@/lib/social/freshness";
import { getInstagramAccountInsights } from "@/lib/social/instagram-account-insights";
import type { InstagramAccountInsights } from "@/lib/social/types";
import { createClient } from "@/lib/supabase/server";
import { DashboardCharts } from "./dashboard-charts";
import { takeRecentPostsForAudit } from "@/lib/my-content/strategy-audit";
type SearchParams = Promise<{ range?: string; channel?: string }>;

type ConnectionRow = {
  id: string;
  platform: string;
  display_name: string | null;
  username: string | null;
  status: string;
  metadata: Record<string, unknown>;
  last_successful_sync_at: string | null;
};

type LessonRow = {
  id: string;
  lesson: string;
  lesson_type: string;
  status: string;
  confidence: number | null;
  sample_size: number | null;
};

function rangeLabel(range: PerformanceRange): string {
  return range === "all" ? "All time" : `Last ${range} days`;
}

function metric(value: number | null): string {
  return value === null ? "Unavailable" : Math.round(value).toLocaleString();
}

function sumAvailable(values: Array<number | null | undefined>): number | null {
  const usable = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return usable.length > 0
    ? usable.reduce((total, value) => total + value, 0)
    : null;
}

function Trend({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-secondary">No comparable prior cohort</span>;
  }
  const positive = value >= 0;
  return (
    <span
      className={
        positive
          ? "rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"
          : "rounded-full bg-error/10 px-2 py-1 text-xs font-semibold text-error"
      }
    >
      {positive ? "↑" : "↓"} {Math.abs(value).toFixed(1)}% vs previous publish cohort
    </span>
  );
}

function KpiCard({
  icon,
  label,
  value,
  note,
  trend = null,
  featured = false,
}: {
  icon: string;
  label: string;
  value: string;
  note: string;
  trend?: number | null;
  featured?: boolean;
}) {
  return (
    <Card
      className={
        featured
          ? "border-2 border-primary-container bg-surface-container-lowest paper-shadow"
          : "border-outline-variant/20 bg-surface-container-lowest paper-shadow"
      }
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm text-secondary">
          <MaterialIcon name={icon} className="text-lg text-primary-container" />
          <span>{label}</span>
        </div>
        <p className="mt-2 font-headline text-3xl font-bold text-on-background">
          {value}
        </p>
        <div className="mt-3">
          {trend === null ? (
            <p className="text-xs text-secondary">{note}</p>
          ) : (
            <Trend value={trend} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function reportStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedRange = params.range as PerformanceRange | undefined;
  const range: PerformanceRange = PERFORMANCE_RANGES.includes(
    requestedRange as PerformanceRange,
  )
    ? (requestedRange as PerformanceRange)
    : "7";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard");

  const [
    { data: profile },
    { data: connectionData },
    { data: postData },
    { data: snapshotData },
    { data: lessonData },
    { data: latestReport },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("social_connections")
      .select(
        "id, platform, display_name, username, status, metadata, last_successful_sync_at",
      )
      .eq("user_id", user.id)
      .eq("account_type", "owned")
      .neq("status", "disconnected")
      .order("created_at", { ascending: true }),
    supabase
      .from("content_posts")
      .select(
        "id, platform, source, source_label, external_url, thumbnail_url, title, caption, topic, content_pillar, hook_text, classification, format, published_at, views, reach, likes, comments, shares, saves, followers_gained, watch_time_seconds, average_view_duration_seconds, completion_rate, profile_visits, link_clicks, is_winner, needs_review, relative_performance, created_at, metrics_refreshed_at, social_connection_id",
      )
      .eq("user_id", user.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1000),
    supabase
      .from("content_metric_snapshots")
      .select("content_post_id, captured_at, views, followers_gained")
      .eq("user_id", user.id)
      .gte("captured_at", snapshotWindowStart())
      .order("captured_at", { ascending: true })
      .limit(5000),
    supabase
      .from("performance_lessons")
      .select("id, lesson, lesson_type, status, confidence, sample_size")
      .eq("user_id", user.id)
      .in("status", ["confirmed", "supported"])
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("content_weekly_reports")
      .select("id, week_start, week_end, report, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const connections = (connectionData ?? []) as ConnectionRow[];
  const posts = (postData ?? []) as ContentPostRow[];
  const snapshots = (snapshotData ?? []) as MetricSnapshotRow[];
  const lessons = (lessonData ?? []) as LessonRow[];
  const selectedConnection = connections.find(
    (connection) => connection.id === params.channel,
  );
  const selectedConnectionId = selectedConnection?.id ?? null;
  const selectedConnections = selectedConnection
    ? [selectedConnection]
    : connections;
  const channelPosts = filterPostsByConnection(posts, selectedConnectionId);
  const selectedPosts = filterPostsByPerformanceRange(channelPosts, range);
  const previousPosts = filterPostsByPreviousRange(channelPosts, range);
  const selectedSummary = summarizeAccountPerformance(selectedPosts);
  const previousSummary = summarizeAccountPerformance(previousPosts);
  const selectedPostIds = new Set(channelPosts.map((post) => post.id));
  const selectedSnapshots = snapshots.filter((snapshot) =>
    selectedPostIds.has(snapshot.content_post_id),
  );
  const chartDays = range === "all" ? 365 : Number(range);
  const viewsSeries = buildGrowthSeries({
    posts: channelPosts,
    snapshots: selectedSnapshots,
    metric: "impressions",
    days: chartDays,
  });
  const instagramInsights = selectedConnections
    .map((connection) => getInstagramAccountInsights(connection.metadata))
    .filter((insight): insight is InstagramAccountInsights => Boolean(insight));
  const postFollowerSeries = buildGrowthSeries({
    posts: channelPosts,
    snapshots: selectedSnapshots,
    metric: "followers",
    days: chartDays,
  });
  const followerChanges =
    instagramInsights.length > 0
      ? buildAccountFollowerSeries({ insights: instagramInsights, days: chartDays })
      : postFollowerSeries.points.map((point) => ({
          date: point.date,
          value: point.value,
        }));
  const currentFollowers = sumAvailable(
    selectedConnections.map((connection) =>
      connectionFollowerCount(connection.metadata),
    ),
  );
  const accountTotals = aggregateInstagramAccountTotals(instagramInsights);
  const netFollowers30d =
    accountTotals.follows !== null || accountTotals.unfollows !== null
      ? (accountTotals.follows ?? 0) - (accountTotals.unfollows ?? 0)
      : null;
  const postFollowerGain = sumAvailable(
    selectedPosts.map((post) => post.followers_gained),
  );
  const followerGain =
    instagramInsights.length > 0 ? netFollowers30d : postFollowerGain;
  const followerGainLabel =
    instagramInsights.length > 0 ? "Net followers (30d)" : "Followers gained";
  const viewsTrend = percentageChange(
    selectedSummary.totalViews,
    previousSummary.totalViews,
  );
  const postTrend = percentageChange(
    selectedSummary.postCount,
    previousSummary.postCount || null,
  );
  const remix = buildRemixIngredients(selectedPosts);
  const recentVideos = [...selectedPosts]
    .filter((post) => typeof post.views === "number")
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 8);
  const report = (latestReport?.report ?? {}) as Record<string, unknown>;
  const executionNotes = [
    ...lessons.map((lesson) => ({
      tone: "lesson" as const,
      text: lesson.lesson,
      label: `${lesson.status} · ${lesson.sample_size ?? "?"} posts`,
    })),
    ...reportStrings(report.whatSeemsWorking).map((text) => ({
      tone: "working" as const,
      text,
      label: "Weekly review · working",
    })),
    ...reportStrings(report.whatSeemsWeaker).map((text) => ({
      tone: "weaker" as const,
      text,
      label: "Weekly review · weaker",
    })),
  ].slice(0, 6);
  const firstName = profile?.display_name?.trim().split(/\s+/)[0] ?? null;
  const latestSync = selectedConnections
    .map((connection) => connection.last_successful_sync_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-container">
            Account intelligence
          </p>
          <h1 className="mt-2 font-headline text-3xl font-bold text-on-background md:text-4xl">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-2 text-secondary">
            A complete, evidence-labelled look at how your connected channels are performing.
          </p>
          <p className="mt-2 text-xs text-secondary">
            {latestSync
              ? `Latest successful sync ${formatRelativeTime(latestSync) ?? "recently"}.`
              : "Connect or refresh an account to populate live analytics."}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
          <RefreshAllConnectedButton
            disabled={connections.length === 0}
            label="Refresh data"
          />
          <form
            action="/dashboard"
            method="get"
            className="flex flex-wrap items-center gap-2"
          >
            <select
              name="channel"
              defaultValue={selectedConnectionId ?? "all"}
              aria-label="Channel"
              className="h-9 min-w-40 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
            >
              <option value="all">All channels</option>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.display_name || connection.username || connection.platform} · {connection.platform}
                </option>
              ))}
            </select>
            <select
              name="range"
              defaultValue={range}
              aria-label="Date range"
              className="h-9 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
            >
              {PERFORMANCE_RANGES.map((value) => (
                <option key={value} value={value}>
                  {rangeLabel(value)}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="outline">
              Apply
            </Button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          featured
          icon="trophy"
          label="Total followers"
          value={metric(currentFollowers)}
          note="Current provider-reported total across selected channels"
        />
        <KpiCard
          icon="person_add"
          label={followerGainLabel}
          value={metric(followerGain)}
          note={
            instagramInsights.length > 0
              ? "Provider-reported follows minus unfollows in Instagram’s insight window"
              : "Summed only where post-level follower gain is available"
          }
        />
        <KpiCard
          icon="visibility"
          label="Views"
          value={metric(selectedSummary.totalViews)}
          note={`Current metrics on posts published in ${rangeLabel(range).toLowerCase()}`}
          trend={viewsTrend}
        />
        <KpiCard
          icon="movie"
          label="Number of posts"
          value={selectedSummary.postCount.toLocaleString()}
          note={`Posts published in ${rangeLabel(range).toLowerCase()}`}
          trend={postTrend}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardContent className="p-5 md:p-6">
            <DashboardCharts
              views={viewsSeries}
              followerChanges={followerChanges}
              currentFollowers={currentFollowers}
              followerBasis={
                instagramInsights.length > 0
                  ? "Instagram daily account insights; channels without daily history remain flat"
                  : "Post-level follower gains credited to publish date"
              }
            />
          </CardContent>
        </Card>

        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Recent videos</CardTitle>
                <CardDescription>Ranked by current views</CardDescription>
              </div>
              <Badge>{rangeLabel(range)}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {recentVideos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant/30 p-6 text-sm text-secondary">
                No videos with views in this selection. Sync a channel or widen the range.
              </div>
            ) : (
              <ol className="space-y-2">
                {recentVideos.map((post, index) => (
                  <li key={post.id}>
                    <Link
                      href={`/my-content/${post.id}`}
                      className="grid grid-cols-[24px_44px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-transparent p-2 hover:border-outline-variant/20 hover:bg-surface-container-lowest"
                    >
                      <span className="text-xs font-semibold text-secondary">{index + 1}</span>
                      <div className="relative h-11 w-11 overflow-hidden rounded bg-surface-container-low">
                        {post.thumbnail_url ? (
                          <Image
                            src={post.thumbnail_url}
                            alt=""
                            fill
                            unoptimized
                            sizes="44px"
                            className="object-cover"
                          />
                        ) : (
                          <MaterialIcon
                            name="movie"
                            className="absolute inset-0 m-auto h-6 w-6 text-secondary"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-on-background">
                          {post.title || post.caption?.slice(0, 64) || "Untitled"}
                        </p>
                        <p className="mt-0.5 truncate text-xs capitalize text-secondary">
                          {post.platform.replace(/_/g, " ")}
                          {post.published_at
                            ? ` · ${formatRelativeTime(post.published_at) ?? "published"}`
                            : ""}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-on-background">
                        {formatCompact(post.views ?? 0)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>

      {instagramInsights.length > 0 ? (
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-headline text-xl font-semibold text-on-background">
                Instagram account signals
              </h2>
              <p className="mt-1 text-sm text-secondary">
                Provider-reported account totals from the latest 30-day insight window.
              </p>
            </div>
            <Badge variant="primary">Instagram API</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Reach", accountTotals.reach, "group"],
              ["Profile views", accountTotals.profileViews, "person_search"],
              ["Accounts engaged", accountTotals.accountsEngaged, "forum"],
              ["Profile link taps", accountTotals.profileLinksTaps, "ads_click"],
            ].map(([label, rawValue, icon]) => (
              <div
                key={label as string}
                className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4"
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                  <MaterialIcon name={icon as string} className="text-lg text-primary-container" />
                  {label as string}
                </div>
                <p className="mt-2 font-headline text-2xl font-bold text-on-background">
                  {metric(rawValue as number | null)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-outline-variant/20 pt-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-headline text-2xl font-bold text-on-background">
              Content strategy audit
            </h2>
            <p className="mt-1 text-secondary">
              Topics, hooks, formats, and scriptwriting multipliers from your last 30 videos — play, analyze, or save clips to Idea Bank.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {latestReport?.created_at ? (
              <span className="text-xs text-secondary">
                Review generated {formatRelativeTime(latestReport.created_at) ?? "recently"}
              </span>
            ) : null}
            <GenerateWeeklyReviewButton />
          </div>
        </div>

        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardContent className="p-5 md:p-6">
            <ContentStrategyAudit
              posts={takeRecentPostsForAudit(selectedPosts, 30)}
              sampleLabel="your last 30 videos"
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>How you’re executing</CardTitle>
            <CardDescription>
              Supported lessons and the latest weekly review—not generic advice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {executionNotes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant/30 p-6 text-sm text-secondary">
                Generate a weekly review or confirm performance lessons in My Content to populate this section.
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant/15">
                {executionNotes.map((note, index) => (
                  <li key={`${note.label}-${index}`} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                    <MaterialIcon
                      name={
                        note.tone === "working"
                          ? "trending_up"
                          : note.tone === "weaker"
                            ? "trending_down"
                            : "lightbulb"
                      }
                      className={
                        note.tone === "weaker"
                          ? "mt-0.5 text-error"
                          : "mt-0.5 text-primary-container"
                      }
                    />
                    <div>
                      <p className="text-sm leading-relaxed text-on-background">{note.text}</p>
                      <p className="mt-1 text-xs capitalize text-secondary">{note.label}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Next test mix</CardTitle>
            <CardDescription>
              Shuffle a proven topic and hook from different posts. This suggests an experiment, not a guaranteed winner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContentRemix topics={remix.topics} hooks={remix.hooks} />
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-outline-variant/20 pt-6">
        <Button asChild variant="outline">
          <Link href="/performance">Open full performance analytics</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/my-content">Review individual videos</Link>
        </Button>
        <Button asChild>
          <Link href="/research?mode=discover">Discover niche videos</Link>
        </Button>
      </div>
    </div>
  );
}
