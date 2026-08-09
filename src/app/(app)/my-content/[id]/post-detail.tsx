"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PageHeader } from "@/components/layout/page-header";
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
  getInstagramEmbedUrl,
  getPostEngagementRate,
  type PerformanceInsight,
} from "@/lib/my-content/performance";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import { analyzeMyContentPost } from "@/app/(app)/analyze/actions";
import { deletePost } from "../actions";
import { sourceLabelForSynced } from "@/lib/social/freshness";

type DisplayMetric = {
  label: string;
  value: number | string | null | undefined;
};

function MetricValue({ value }: { value: DisplayMetric["value"] }) {
  if (value === null || value === undefined) {
    return <span className="text-secondary">Unavailable</span>;
  }
  return <span>{typeof value === "number" ? value.toLocaleString() : value}</span>;
}

function formatSeconds(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value < 60) return `${Math.round(value)} sec`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}m ${seconds}s`;
}

function formatCompletionRate(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const percentage = value <= 1 ? value * 100 : value;
  return `${percentage.toFixed(1)}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function PostDetailClient({
  post,
  performanceInsights,
  viewsRank,
  viewsMultiplier,
  providerMetrics,
}: {
  post: ContentPostRow;
  performanceInsights: PerformanceInsight[];
  viewsRank: string | null;
  viewsMultiplier: string | null;
  providerMetrics: Record<string, unknown>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const embedUrl =
    post.platform === "instagram" ? getInstagramEmbedUrl(post.external_url) : null;
  const engagementRate = getPostEngagementRate(post);
  const liveSourceLabel =
    post.source === "connected_account"
      ? sourceLabelForSynced(post.platform, post.metrics_refreshed_at ?? null)
      : post.source_label;
  const reelsSkipRate =
    typeof providerMetrics.reels_skip_rate === "number"
      ? providerMetrics.reels_skip_rate
      : null;

  const metrics: DisplayMetric[] = [
    { label: "Views", value: post.views },
    { label: "Reach", value: post.reach },
    { label: "Likes", value: post.likes },
    { label: "Comments", value: post.comments },
    { label: "Shares", value: post.shares },
    { label: "Saves", value: post.saves },
    {
      label: engagementRate
        ? `Engagement rate by ${engagementRate.denominator}`
        : "Engagement rate",
      value: engagementRate ? `${engagementRate.value.toFixed(2)}%` : null,
    },
    { label: "Followers gained", value: post.followers_gained },
    { label: "Watch time", value: formatSeconds(post.watch_time_seconds) },
    {
      label: "Average view duration",
      value: formatSeconds(post.average_view_duration_seconds),
    },
    {
      label: "3-second skip rate",
      value: reelsSkipRate === null ? null : `${reelsSkipRate.toFixed(1)}%`,
    },
    {
      label: "Completion rate (not supplied by Meta)",
      value: formatCompletionRate(post.completion_rate),
    },
    { label: "Profile visits", value: post.profile_visits },
  ];

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/my-content">
          <MaterialIcon name="arrow_back" className="text-base" />
          Back to My Content
        </Link>
      </Button>

      <PageHeader
        title={post.title || "Untitled post"}
        description={post.caption ?? undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              disabled={isPending}
              onClick={() => {
                setAnalyzeError(null);
                startTransition(async () => {
                  const result = await analyzeMyContentPost(post.id);
                  if (result?.error) setAnalyzeError(result.error);
                });
              }}
            >
              <MaterialIcon name="movie_filter" className="text-base" />
              Analyze
            </Button>
            <Button asChild variant="outline">
              <Link href={`/experiments`}>Attach to experiment</Link>
            </Button>
            {post.external_url ? (
              <Button asChild variant="outline">
                <a href={post.external_url} target="_blank" rel="noreferrer">
                  Open original
                  <MaterialIcon name="open_in_new" className="text-base" />
                </a>
              </Button>
            ) : null}
          </div>
        }
      />

      {analyzeError ? (
        <p className="mb-4 text-sm text-destructive">{analyzeError}</p>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="default">{post.platform.replace(/_/g, " ")}</Badge>
        <Badge variant="primary">{liveSourceLabel}</Badge>
        {post.format ? <Badge variant="default">{post.format}</Badge> : null}
        {post.is_winner ? <Badge variant="success">Winner</Badge> : null}
        {post.needs_review ? <Badge variant="warning">Needs review</Badge> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Post preview</CardTitle>
            <CardDescription>
              Embedded from the original public Instagram post.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={`Instagram post: ${post.title || "Untitled post"}`}
                loading="lazy"
                allow="autoplay; encrypted-media; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-[720px] w-full rounded-lg border-0 bg-white"
              />
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant/30 bg-surface-container-lowest p-6 text-center">
                <MaterialIcon name="movie" className="text-4xl text-secondary" />
                <p className="mt-3 text-sm text-secondary">
                  An embeddable Instagram permalink is unavailable for this item.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardHeader>
              <CardTitle>
                {post.is_winner ? "Why this post stood out" : "What the data suggests"}
              </CardTitle>
              <CardDescription>
                Transparent comparisons with your own recent posts. These signals show
                what differed; they do not prove creative causation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {performanceInsights.map((insight) => (
                  <li
                    key={`${insight.title}-${insight.detail}`}
                    className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4"
                  >
                    <Badge
                      variant={
                        insight.tone === "positive"
                          ? "success"
                          : insight.tone === "warning"
                            ? "warning"
                            : "default"
                      }
                    >
                      {insight.tone === "positive" ? "Above baseline" : insight.tone}
                    </Badge>
                    <p className="mt-2 font-semibold text-on-background">
                      {insight.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-secondary">
                      {insight.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardHeader>
              <CardTitle>Performance</CardTitle>
              <CardDescription>
                Latest synchronized totals. Missing metrics stay unavailable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {metrics.map((metric) => (
                  <div key={metric.label}>
                    <dt className="text-xs font-semibold uppercase tracking-widest text-primary-container">
                      {metric.label}
                    </dt>
                    <dd className="mt-1 text-lg font-medium text-on-background">
                      <MetricValue value={metric.value} />
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 space-y-1 border-t border-outline-variant/15 pt-4 text-sm text-secondary">
                {viewsRank ? <p>{viewsRank}</p> : null}
                {viewsMultiplier ? <p>{viewsMultiplier}</p> : null}
                <p>Metrics updated: {formatDate(post.metrics_refreshed_at)}</p>
              </div>
              {post.platform === "instagram" ? (
                <div className="mt-5 rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4 text-xs leading-relaxed text-secondary">
                  <p className="font-semibold text-on-background">
                    Why some Instagram metrics are unavailable
                  </p>
                  <p className="mt-2">
                    Reels can report watch time, average watch time, and 3-second
                    skip rate. Images and carousels can report post-attributed
                    follows and profile visits. Meta does not provide a per-post
                    completion rate, so FormCraft does not estimate one.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6 border-outline-variant/20 bg-surface-primary paper-shadow">
        <CardHeader>
          <CardTitle>Post details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
                Source
              </p>
              <p className="mt-1 text-on-background">{liveSourceLabel}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
                Published
              </p>
              <p className="mt-1 text-on-background">{formatDate(post.published_at)}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
              Caption
            </p>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed text-on-background">
              {post.caption || "No caption available."}
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => {
              if (!window.confirm("Delete this post permanently?")) return;
              startTransition(async () => {
                await deletePost(post.id);
                router.push("/my-content");
              });
            }}
          >
            Delete post
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
