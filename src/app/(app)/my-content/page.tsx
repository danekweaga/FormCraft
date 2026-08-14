import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MaterialIcon } from "@/components/layout/material-icon";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  computeBaselines,
  getRelativeMultiplier,
  getRelativeRank,
  type ContentBaselines,
} from "@/lib/my-content/baseline";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import {
  connectionFollowerCount,
  connectionFreshness,
  formatFollowerCount,
  formatRelativeTime,
  sourceLabelForSynced,
} from "@/lib/social/freshness";
import {
  getOwnedProvider,
  isOwnedPlatform,
} from "@/lib/social/providers";
import {
  isReconnectRequiredError,
  reconnectRequiredCopy,
} from "@/lib/social/reconnect";
import type { OwnedPlatform, SocialConnectionRow } from "@/lib/social/types";
import { createClient } from "@/lib/supabase/server";
import {
  ReconnectAccountButton,
  RefreshAllConnectedButton,
  SyncNowButton,
} from "../connections/connection-actions";
import { RunIntelligenceButton } from "./intelligence-actions";
import { LessonActions } from "./lesson-actions";
import { ManualPostDialog } from "./my-content-actions";

type SearchParams = Promise<{
  q?: string;
  filter?: string;
  source?: string;
  platform?: string;
}>;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "manual", label: "Manual" },
  { id: "uploaded", label: "Uploaded" },
] as const;

function formatDate(value: string | null) {
  if (!value) return "Date unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function PostCard({
  post,
  recentPosts,
  baselines,
}: {
  post: ContentPostRow;
  recentPosts: ContentPostRow[];
  baselines: ContentBaselines;
}) {
  const viewsRank = getRelativeRank(post, recentPosts, "views");
  const viewsMultiplier = getRelativeMultiplier(post, baselines, "views");

  return (
    <Link
      href={`/my-content/${post.id}`}
      className="block rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow transition-colors hover:border-primary-container/30"
    >
      <div className="flex flex-wrap items-start gap-2">
        <h3 className="font-headline text-lg font-semibold text-on-background">
          {post.title || post.caption?.slice(0, 60) || "Untitled post"}
        </h3>
        {post.is_winner ? <Badge variant="success">Winner</Badge> : null}
        {post.needs_review ? <Badge variant="warning">Needs review</Badge> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="default">{post.platform.replace(/_/g, " ")}</Badge>
        <Badge variant="primary">
          {post.source === "connected_account"
            ? sourceLabelForSynced(
                post.platform,
                post.metrics_refreshed_at ?? null,
              )
            : post.source_label}
        </Badge>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-secondary">{post.caption}</p>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-secondary">
        <span>{formatDate(post.published_at)}</span>
        <span>
          Views: {post.views !== null ? post.views.toLocaleString() : "Unavailable"}
        </span>
        {viewsRank ? <span>{viewsRank}</span> : null}
        {viewsMultiplier ? <span>{viewsMultiplier}</span> : null}
      </div>
    </Link>
  );
}

export default async function MyContentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, filter, source, platform } = await searchParams;
  const activeFilter = filter ?? (source === "connected_account" && platform
    ? platform
    : source === "manual_entry"
      ? "manual"
      : "all");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: lessons } = await supabase
    .from("performance_lessons")
    .select("id, lesson, evidence, confidence, sample_size, status, created_at")
    .eq("user_id", user.id)
    .in("status", ["suggested", "testing", "confirmed", "supported"])
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: ownedConnections } = await supabase
    .from("social_connections")
    .select(
      "id, platform, status, last_successful_sync_at, last_error, sync_frequency_hours, metadata, username, display_name",
    )
    .eq("user_id", user.id)
    .eq("account_type", "owned")
    .neq("status", "disconnected")
    .order("created_at", { ascending: false });

  const connectedAccounts = (
    (ownedConnections ?? []) as Array<
      Pick<
        SocialConnectionRow,
        | "id"
        | "platform"
        | "status"
        | "last_successful_sync_at"
        | "last_error"
        | "sync_frequency_hours"
        | "metadata"
        | "username"
        | "display_name"
      >
    >
  )
    .filter((connection): connection is typeof connection & {
      platform: OwnedPlatform;
    } => isOwnedPlatform(connection.platform));

  const refreshableCount = connectedAccounts.filter(
    (connection) =>
      getOwnedProvider(connection.platform).isConfigured() &&
      !isReconnectRequiredError(connection.last_error),
  ).length;

  let postsQuery = supabase
    .from("content_posts")
    .select(
      "id, platform, source, source_label, title, caption, published_at, views, likes, comments, shares, saves, followers_gained, is_winner, needs_review, relative_performance, created_at, metrics_refreshed_at, social_connection_id",
    )
    .eq("user_id", user.id)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (q?.trim()) {
    postsQuery = postsQuery.or(
      `title.ilike.%${q.trim()}%,caption.ilike.%${q.trim()}%`,
    );
  }

  if (activeFilter === "instagram") {
    postsQuery = postsQuery.eq("platform", "instagram");
  } else if (activeFilter === "tiktok") {
    postsQuery = postsQuery.eq("platform", "tiktok");
  } else if (activeFilter === "youtube") {
    postsQuery = postsQuery.in("platform", ["youtube", "youtube_shorts"]);
  } else if (activeFilter === "manual") {
    postsQuery = postsQuery.in("source", ["manual_entry", "post_url", "csv_import"]);
  } else if (activeFilter === "uploaded") {
    postsQuery = postsQuery.in("source", ["video_upload", "transcript_upload"]);
  } else if (source === "connected_account") {
    postsQuery = postsQuery.eq("source", "connected_account");
    if (platform) {
      if (platform === "youtube") {
        postsQuery = postsQuery.in("platform", ["youtube", "youtube_shorts"]);
      } else {
        postsQuery = postsQuery.eq("platform", platform);
      }
    }
  }

  const { data: posts } = await postsQuery;
  const allPosts = (posts ?? []) as ContentPostRow[];
  const recentPosts = allPosts.slice(0, 10);
  const baselines = computeBaselines(allPosts);
  const winners = allPosts.filter((p) => p.is_winner);
  const needsReview = allPosts.filter((p) => p.needs_review);

  return (
    <div>
      <PageHeader
        title="My Content"
        description="Your published content library — synced from connected accounts and manual entry. Both coexist."
        actions={
          <div className="flex flex-wrap gap-2">
            <RunIntelligenceButton />
            <Button asChild variant="outline">
              <Link href="/connections">Connections</Link>
            </Button>
            <ManualPostDialog />
          </div>
        }
      />

      <div className="mb-8 rounded-lg border border-outline-variant/15 bg-surface-container-lowest/60 p-4 text-sm text-secondary">
        <MaterialIcon
          name="info"
          className="mr-1 inline text-base text-primary-container"
        />
        Each item shows its data source (e.g. Instagram · Synced 18 minutes ago
        or Manual). Missing metrics stay unavailable — never invented.
      </div>

      {connectedAccounts.length > 0 ? (
        <Card className="mb-8 border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Refresh connected posts & followers</CardTitle>
              <CardDescription>
                Pull the latest posts and follower counts from accounts you have
                authorized. Only platforms that are connected and configured can
                refresh.
              </CardDescription>
            </div>
            <RefreshAllConnectedButton disabled={refreshableCount === 0} />
          </CardHeader>
          <CardContent className="space-y-3">
            {connectedAccounts.map((connection) => {
              const needsReconnect = isReconnectRequiredError(
                connection.last_error,
              );
              const configured = getOwnedProvider(
                connection.platform,
              ).isConfigured();
              const freshness = connectionFreshness({
                status: connection.status,
                lastSuccessfulSyncAt: connection.last_successful_sync_at,
                lastError: connection.last_error,
                staleAfterHours: connection.sync_frequency_hours * 2,
              });
              const followers = connectionFollowerCount(connection.metadata);
              const label =
                connection.display_name ??
                connection.username ??
                connection.platform;

              return (
                <div
                  key={connection.id}
                  className="flex flex-col gap-3 rounded-lg border border-outline-variant/15 bg-surface-container-lowest/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <p className="font-medium capitalize text-on-background">
                      {connection.platform.replace(/_/g, " ")} · {label}
                    </p>
                    <p className="mt-1 text-xs text-secondary">
                      Last sync:{" "}
                      {formatRelativeTime(connection.last_successful_sync_at) ??
                        "Never"}{" "}
                      · {freshness.label} · Followers:{" "}
                      {formatFollowerCount(followers)}
                    </p>
                    {needsReconnect ? (
                      <p className="mt-1 text-xs text-error">
                        {reconnectRequiredCopy(connection.platform)}
                      </p>
                    ) : connection.last_error ? (
                      <p className="mt-1 text-xs text-error">
                        {connection.last_error}
                      </p>
                    ) : null}
                    {!configured ? (
                      <p className="mt-1 text-xs text-error">
                        {getOwnedProvider(connection.platform).unconfiguredReason() ??
                          "Platform not configured — refresh disabled."}
                      </p>
                    ) : null}
                  </div>
                  {needsReconnect ? (
                    <ReconnectAccountButton platform={connection.platform} />
                  ) : (
                    <SyncNowButton
                      connectionId={connection.id}
                      disabled={
                        !configured || connection.status === "syncing"
                      }
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <div className="mb-8 rounded-lg border border-outline-variant/15 bg-surface-container-lowest/60 p-4 text-sm text-secondary">
          No connected accounts yet.{" "}
          <Link href="/connections" className="text-primary underline">
            Connect a platform
          </Link>{" "}
          to refresh posts and followers automatically.
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const href =
            item.id === "all" ? "/my-content" : `/my-content?filter=${item.id}`;
          const active = activeFilter === item.id;
          return (
            <Link
              key={item.id}
              href={href}
              className={
                active
                  ? "rounded-lg bg-primary-container px-3 py-1.5 text-xs font-semibold text-on-primary-container"
                  : "rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-surface-container-low"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <Card className="mb-8 border-outline-variant/20 bg-surface-primary paper-shadow">
        <CardHeader>
          <CardTitle>What FormCraft learned about your content</CardTitle>
          <CardDescription>
            Performance lessons from your posts — confirm or reject suggestions as
            they appear.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(lessons?.length ?? 0) === 0 ? (
            <EmptyState
              title="Not enough data yet"
              description="Add more posts with metrics to unlock performance lessons. FormCraft needs real history before suggesting patterns."
            />
          ) : (
            <ul className="space-y-4">
              {lessons!.map((lesson) => (
                <li
                  key={lesson.id}
                  className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Badge
                        variant={
                          lesson.status === "confirmed" ? "success" : "warning"
                        }
                      >
                        {lesson.status}
                      </Badge>
                      <p className="mt-2 text-sm leading-relaxed text-on-background">
                        {lesson.lesson}
                      </p>
                      {lesson.confidence !== null ? (
                        <p className="mt-2 text-xs text-secondary">
                          Confidence: {Number(lesson.confidence).toFixed(0)}%
                          {lesson.sample_size
                            ? ` · Sample: ${lesson.sample_size} posts`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                    {lesson.status === "suggested" ? (
                      <LessonActions lessonId={lesson.id} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-headline text-xl font-semibold text-on-background">
            Winners
          </h2>
          {winners.length === 0 ? (
            <p className="text-sm text-secondary">
              No winners flagged yet. Posts with views above 1.5× your median are
              marked automatically when metrics exist.
            </p>
          ) : (
            <ul className="space-y-3">
              {winners.slice(0, 3).map((post) => (
                <li key={post.id}>
                  <PostCard post={post} recentPosts={recentPosts} baselines={baselines} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-headline text-xl font-semibold text-on-background">
            Needs review
          </h2>
          {needsReview.length === 0 ? (
            <p className="text-sm text-secondary">
              No underperformers flagged. Posts below 50% of your median views
              are marked when enough history exists.
            </p>
          ) : (
            <ul className="space-y-3">
              {needsReview.slice(0, 3).map((post) => (
                <li key={post.id}>
                  <PostCard post={post} recentPosts={recentPosts} baselines={baselines} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-headline text-xl font-semibold text-on-background">
            Recent posts
          </h2>
          <form method="get" className="flex gap-2">
            <Input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search posts…"
              className="max-w-xs"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 text-sm"
            >
              Search
            </button>
          </form>
        </div>

        {allPosts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Add your first post manually to start building your content library."
            action={<ManualPostDialog />}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {allPosts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} recentPosts={recentPosts} baselines={baselines} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
