"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  getRelativeMultiplier,
  getRelativeRank,
  type ContentBaselines,
} from "@/lib/my-content/baseline";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import { deletePost } from "../actions";

function MetricValue({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-secondary">Unavailable</span>;
  }
  return <span>{value.toLocaleString()}</span>;
}

export function PostDetailClient({
  post,
  recentPosts,
  baselines,
}: {
  post: ContentPostRow;
  recentPosts: ContentPostRow[];
  baselines: ContentBaselines;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const metrics = [
    ["Views", post.views],
    ["Likes", post.likes],
    ["Comments", post.comments],
    ["Shares", post.shares],
    ["Saves", post.saves],
    ["Followers gained", post.followers_gained],
  ] as const;

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
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="default">{post.platform.replace(/_/g, " ")}</Badge>
        <Badge variant="primary">{post.source_label}</Badge>
        {post.is_winner ? <Badge variant="success">Winner</Badge> : null}
        {post.needs_review ? <Badge variant="warning">Needs review</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Metrics</CardTitle>
            <CardDescription>
              Null values display as unavailable — never fabricated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {metrics.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-primary-container">
                    {label}
                  </dt>
                  <dd className="mt-1 text-lg font-medium text-on-background">
                    <MetricValue value={value} />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 space-y-1 text-sm text-secondary">
              {getRelativeRank(post, recentPosts, "views") ? (
                <p>{getRelativeRank(post, recentPosts, "views")}</p>
              ) : null}
              {getRelativeMultiplier(post, baselines, "views") ? (
                <p>{getRelativeMultiplier(post, baselines, "views")}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
                Source
              </p>
              <p className="mt-1 text-on-background">{post.source_label}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
                Published
              </p>
              <p className="mt-1 text-on-background">
                {post.published_at
                  ? new Date(post.published_at).toLocaleDateString()
                  : "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
                Caption
              </p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-on-background">
                {post.caption}
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
    </div>
  );
}
