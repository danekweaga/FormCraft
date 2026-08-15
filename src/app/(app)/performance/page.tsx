import Link from "next/link";
import { redirect } from "next/navigation";
import { IntelligenceExplanation } from "@/components/intelligence/intelligence-explanation";
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
import { EmptyState } from "@/components/ui/empty-state";
import {
  buildRemixIngredients,
  buildTopicPerformance,
  filterPostsByPerformanceRange,
  PERFORMANCE_RANGES,
  type PerformanceRange,
} from "@/lib/my-content/dashboard";
import {
  buildGrowthSeries,
  buildYearHeatmap,
  snapshotWindowStart,
  toDayKey,
  type MetricSnapshotRow,
} from "@/lib/my-content/growth-series";
import {
  getPostEngagementRate,
  summarizeAccountPerformance,
} from "@/lib/my-content/performance";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import {
  accountInsightsFollowerGain,
  accountInsightsViewsTotal,
  buildAccountFollowerGainSeries,
  buildAccountViewsSeries,
} from "@/lib/my-content/account-dashboard";
import { getInstagramAccountInsights } from "@/lib/social/instagram-account-insights";
import type { InstagramAccountInsights } from "@/lib/social/types";
import { createClient } from "@/lib/supabase/server";
import { ContentRemix } from "./content-remix";
import { ContentStrategyAudit } from "./content-strategy-audit";
import { GrowthChart } from "./growth-chart";
import { ImpressionsHeatmap } from "./impressions-heatmap";
import { PeriodReviewPanel } from "./period-review-panel";
import {
  SavedTranscriptMatcher,
  TopicClassificationButton,
} from "./topic-classification-button";
import { GenerateWeeklyReviewButton } from "./weekly-actions";
import { takeRecentPostsForAudit } from "@/lib/my-content/strategy-audit";

type SearchParams = Promise<{ range?: string }>;

function number(value: number | null, suffix = "") {
  return value === null ? "Unavailable" : `${Math.round(value).toLocaleString()}${suffix}`;
}

function labelForRange(range: PerformanceRange) {
  return range === "all" ? "All time" : `${range} days`;
}

function mapFromPoints(
  points: Array<{ date: string; value: number }>,
): Map<string, number> {
  return new Map(points.map((point) => [point.date, point.value]));
}

function sumPoints(points: Array<{ date: string; value: number }>): number {
  return points.reduce((total, point) => total + point.value, 0);
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const requestedRange = (await searchParams).range;
  const range: PerformanceRange = PERFORMANCE_RANGES.includes(
    requestedRange as PerformanceRange,
  )
    ? (requestedRange as PerformanceRange)
    : "30";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [
    { data: latest },
    { data: posts },
    { data: snapshots },
    { data: savedDrafts },
    { data: connections },
  ] =
    await Promise.all([
      supabase
        .from("content_weekly_reports")
        .select("id, week_start, week_end, report, created_at")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("content_posts")
        .select(
          "id, platform, source, source_label, external_url, thumbnail_url, title, caption, topic, content_pillar, hook_text, classification, format, published_at, views, reach, likes, comments, shares, saves, followers_gained, watch_time_seconds, average_view_duration_seconds, completion_rate, profile_visits, link_clicks, is_winner, needs_review, relative_performance, created_at, metrics_refreshed_at, social_connection_id",
        )
        .eq("user_id", user.id)
        .order("published_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("content_metric_snapshots")
        .select("content_post_id, captured_at, views, followers_gained")
        .eq("user_id", user.id)
        .gte("captured_at", snapshotWindowStart())
        .order("captured_at", { ascending: true })
        .limit(5000),
      supabase
        .from("pre_publish_reviews")
        .select("id, source_ref, input_text, created_at")
        .eq("user_id", user.id)
        .is("content_post_id", null)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("social_connections")
        .select("id, platform, metadata")
        .eq("user_id", user.id)
        .eq("status", "connected"),
    ]);

  const selectedPosts = filterPostsByPerformanceRange(
    (posts ?? []) as ContentPostRow[],
    range,
  );
  const summary = summarizeAccountPerformance(selectedPosts);
  const topics = buildTopicPerformance(selectedPosts).slice(0, 8);
  const specificallyClassifiedCount = selectedPosts.filter((post) =>
    Boolean(post.topic?.trim()),
  ).length;
  const missingTopicCount = selectedPosts.length - specificallyClassifiedCount;
  const missingTopicPostOptions = selectedPosts
    .filter((post) => !post.topic?.trim())
    .map((post) => ({
      id: post.id,
      label: (post.title || post.caption || "Untitled").slice(0, 90),
    }));
  const savedDraftOptions = (savedDrafts ?? [])
    .filter((review) => review.input_text?.trim().length >= 20)
    .map((review) => ({
      id: review.id,
      label: (review.source_ref || review.input_text || "Saved draft").slice(0, 90),
    }));
  const remix = buildRemixIngredients(selectedPosts);
  const report = (latest?.report ?? null) as Record<string, unknown> | null;
  const maxTopViews = Math.max(
    1,
    ...summary.topPosts.map((post) => post.views ?? 0),
  );
  const maxTopicViews = Math.max(
    1,
    ...topics.map((topic) => topic.averageViews ?? 0),
  );

  const allPosts = (posts ?? []) as ContentPostRow[];
  const metricSnapshots = (snapshots ?? []) as MetricSnapshotRow[];
  const seriesDays = range === "all" ? 365 : Number(range);
  const instagramInsights = (connections ?? [])
    .map((connection) => getInstagramAccountInsights(connection.metadata))
    .filter((insight): insight is InstagramAccountInsights => Boolean(insight));

  const accountViewDays =
    instagramInsights.length > 0
      ? buildAccountViewsSeries({
          insights: instagramInsights,
          days: seriesDays,
        })
      : null;
  const accountViewsTotal = accountInsightsViewsTotal(instagramInsights);
  const hasDailyAccountViews = Boolean(
    accountViewDays?.some((point) => point.value > 0),
  );
  const impressionsSeries = buildGrowthSeries({
    posts: allPosts,
    snapshots: metricSnapshots,
    metric: "impressions",
    days: seriesDays,
    externalDaily: hasDailyAccountViews
      ? mapFromPoints(accountViewDays!)
      : accountViewsTotal != null && accountViewsTotal > 0
        ? new Map([[toDayKey(new Date()), accountViewsTotal]])
        : null,
    externalBasis: hasDailyAccountViews
      ? "account_daily_views"
      : accountViewsTotal != null && accountViewsTotal > 0
        ? "account_period_views"
        : undefined,
  });

  const followerGainDays =
    instagramInsights.length > 0
      ? buildAccountFollowerGainSeries({
          insights: instagramInsights,
          days: seriesDays,
        })
      : null;
  const periodFollowerGain = accountInsightsFollowerGain(instagramInsights);
  const gainFromDaily = followerGainDays ? sumPoints(followerGainDays) : 0;
  const hasDailyFollowerGains = Boolean(
    followerGainDays?.some((point) => point.value !== 0),
  );
  const preferPeriodFollows =
    periodFollowerGain != null &&
    periodFollowerGain !== 0 &&
    (!hasDailyFollowerGains ||
      Math.abs(gainFromDaily) < Math.abs(periodFollowerGain) * 0.5);
  const followersSeries = preferPeriodFollows
    ? buildGrowthSeries({
        posts: allPosts,
        snapshots: metricSnapshots,
        metric: "followers",
        days: seriesDays,
        externalDaily: new Map([[toDayKey(new Date()), periodFollowerGain!]]),
        externalBasis: "account_period_follows",
      })
    : hasDailyFollowerGains && followerGainDays
      ? buildGrowthSeries({
          posts: allPosts,
          snapshots: metricSnapshots,
          metric: "followers",
          days: seriesDays,
          externalDaily: mapFromPoints(followerGainDays),
          externalBasis: "account_daily_followers",
        })
      : buildGrowthSeries({
          posts: allPosts,
          snapshots: metricSnapshots,
          metric: "followers",
          days: seriesDays,
        });
  const heatmap = buildYearHeatmap({
    posts: allPosts,
    snapshots: metricSnapshots,
    metric: "impressions",
  });

  return (
    <div>
      <PageHeader
        title="Performance Dashboard"
        description={`Owned-account analytics for posts published in the last ${labelForRange(range).toLowerCase()}. Metrics are current cumulative values, not invented period deltas.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/performance/export?range=${range}`}>
                Export Excel CSV
              </a>
            </Button>
            <GenerateWeeklyReviewButton />
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {PERFORMANCE_RANGES.map((value) => (
          <Link
            key={value}
            href={`/performance?range=${value}`}
            className={
              value === range
                ? "rounded-lg bg-primary-container px-3 py-1.5 text-sm font-semibold text-white"
                : "rounded-lg border border-outline-variant/30 px-3 py-1.5 text-sm font-semibold text-secondary hover:bg-surface-container-low"
            }
          >
            {labelForRange(value)}
          </Link>
        ))}
      </div>

      {allPosts.length > 0 ? (
        <div className="mb-6 space-y-6">
          <PeriodReviewPanel posts={allPosts} />
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardContent className="p-6">
              <ContentStrategyAudit
                posts={takeRecentPostsForAudit(allPosts, 30)}
                sampleLabel="your last 30 videos"
              />
            </CardContent>
          </Card>
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardContent className="p-6">
              <GrowthChart
                impressions={impressionsSeries}
                followers={followersSeries}
                rangeLabel={labelForRange(range).toLowerCase()}
              />
            </CardContent>
          </Card>
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardContent className="p-6">
              <ImpressionsHeatmap heatmap={heatmap} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {selectedPosts.length === 0 ? (
        <EmptyState
          title="No posts in this range"
          description="Choose a wider time range, sync a connected account, or keep using manual My Content entries."
          action={<Button asChild><Link href="/my-content">Open My Content</Link></Button>}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Posts", summary.postCount.toLocaleString()],
              ["Total views", number(summary.totalViews)],
              ["Total reach", number(summary.totalReach)],
              [
                "Engagement rate",
                summary.engagementRate
                  ? `${summary.engagementRate.value.toFixed(2)}% / ${summary.engagementRate.denominator}`
                  : "Unavailable",
              ],
            ].map(([label, value]) => (
              <Card key={label} className="border-outline-variant/20 bg-surface-primary paper-shadow">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{label}</p>
                  <p className="mt-2 font-headline text-2xl font-bold text-on-background">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-2">
            <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
              <CardHeader>
                <CardTitle>Top-performing videos</CardTitle>
                <CardDescription>Views for posts published in the selected range.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {summary.topPosts.map((post, index) => (
                  <div key={post.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <Link href={`/my-content/${post.id}`} className="truncate font-semibold text-on-background hover:underline">
                        {index + 1}. {post.title || post.caption?.slice(0, 60) || "Untitled"}
                      </Link>
                      <span className="shrink-0 text-secondary">{number(post.views)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-surface-container-low">
                      <div
                        className="h-full rounded-full bg-primary-container"
                        style={{ width: `${Math.max(2, ((post.views ?? 0) / maxTopViews) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
              <CardHeader>
                <CardTitle>Topics that perform</CardTitle>
                <CardDescription>
                  Average views by reusable topic. Classification uses a stored
                  transcript when available, otherwise the existing title and caption.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3">
                  <p className="text-sm font-semibold text-on-background">
                    {specificallyClassifiedCount}/{selectedPosts.length} posts have a specific topic
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    The free pass never transcribes a video and never calls an AI API.
                    Paste each future script once in Pre-Publish; FormCraft stores it for reuse.
                  </p>
                  {missingTopicCount > 0 ? (
                    <div className="mt-3">
                      <TopicClassificationButton />
                      <SavedTranscriptMatcher
                        posts={missingTopicPostOptions}
                        reviews={savedDraftOptions}
                      />
                    </div>
                  ) : null}
                </div>
                {topics.map((topic) => (
                  <div key={topic.topic}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-semibold text-on-background">{topic.topic}</span>
                      <span className="shrink-0 text-secondary">
                        {number(topic.averageViews)} avg · {topic.postCount} post{topic.postCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-surface-container-low">
                      <div
                        className="h-full rounded-full bg-tertiary"
                        style={{ width: `${Math.max(2, ((topic.averageViews ?? 0) / maxTopicViews) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {topics.length === 0 ? (
                  <p className="text-sm text-secondary">
                    No topics are classified in this range yet. Run the free pass,
                    then correct any remaining posts in My Content.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-3">
            {[
              ["Best by views", summary.topByViews],
              ["Best engagement rate", summary.topByEngagementRate],
              ["Most shared", summary.topByShares],
            ].map(([label, rawPost]) => {
              const post = rawPost as ContentPostRow | null;
              const rate = post ? getPostEngagementRate(post) : null;
              return (
                <Card key={label as string} className="border-outline-variant/20 bg-surface-primary paper-shadow">
                  <CardHeader>
                    <CardTitle className="text-base">{label as string}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {post ? (
                      <>
                        <Link href={`/my-content/${post.id}`} className="font-semibold text-on-background hover:underline">
                          {post.title || post.caption?.slice(0, 80) || "Untitled"}
                        </Link>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="default">{number(post.views)} views</Badge>
                          {rate ? <Badge variant="primary">{rate.value.toFixed(2)}% engagement</Badge> : null}
                        </div>
                      </>
                    ) : <p className="text-sm text-secondary">Unavailable</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="mb-8 border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardHeader>
              <CardTitle>Content remix</CardTitle>
              <CardDescription>
                Shuffle a topic and hook drawn from separate high-performing posts. This creates an experiment, not a promise.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContentRemix topics={remix.topics} hooks={remix.hooks} />
            </CardContent>
          </Card>
        </>
      )}

      {!report ? (
        <EmptyState
          title="No weekly review yet"
          description="Generate a review after you have synced posts. Calculations use your data; AI interprets only when OpenRouter is configured."
        />
      ) : (
        <div className="space-y-4">
          <IntelligenceExplanation
            title="Latest weekly intelligence review"
            recommendation={String(report.performanceSummary ?? "")}
            confidence={(report.confidence as "low" | "medium" | "high") ?? "low"}
            why={[
              `Biggest winner: ${String(report.biggestWinner ?? "—")}`,
              `Biggest miss: ${String(report.biggestMiss ?? "—")}`,
              `Experiment progress: ${String(report.experimentProgress ?? "—")}`,
            ]}
            evidence={[
              `What changed: ${String(report.whatChanged ?? "—")}`,
              `Roadmap impact: ${String(report.roadmapImpact ?? "—")}`,
            ]}
            sources={Array.isArray(report.sourcesUsed) ? (report.sourcesUsed as string[]) : []}
            links={[
              { label: "My Content", href: "/my-content" },
              { label: "Experiments", href: "/experiments" },
              { label: "Roadmap", href: "/roadmap" },
            ]}
          />
          <p className="text-xs text-secondary">
            Week of {latest?.week_start} → {latest?.week_end}
            {report.usedLlm ? " · LLM-assisted" : " · Deterministic summary"}
          </p>
        </div>
      )}
    </div>
  );
}
