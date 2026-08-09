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
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  computeBaselines,
  getRelativeMultiplier,
  getRelativeRank,
  type ContentBaselines,
} from "@/lib/my-content/baseline";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import { createClient } from "@/lib/supabase/server";
import { LessonActions } from "./lesson-actions";
import { ManualPostDialog } from "./my-content-actions";

type SearchParams = Promise<{ q?: string }>;

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
        <Badge variant="primary">{post.source_label}</Badge>
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
  const { q } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: lessons } = await supabase
    .from("performance_lessons")
    .select("id, lesson, evidence, confidence, sample_size, status, created_at")
    .eq("user_id", user.id)
    .in("status", ["suggested", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(10);

  let postsQuery = supabase
    .from("content_posts")
    .select(
      "id, platform, source, source_label, title, caption, published_at, views, likes, comments, shares, saves, followers_gained, is_winner, needs_review, relative_performance, created_at",
    )
    .eq("user_id", user.id)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (q?.trim()) {
    postsQuery = postsQuery.or(
      `title.ilike.%${q.trim()}%,caption.ilike.%${q.trim()}%`,
    );
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
        description="Your published content library and what FormCraft learns from it. Connected social accounts are deferred — add posts manually for now."
        actions={<ManualPostDialog />}
      />

      <div className="mb-8 rounded-lg border border-outline-variant/15 bg-surface-container-lowest/60 p-4 text-sm text-secondary">
        <MaterialIcon
          name="info"
          className="mr-1 inline text-base text-primary-container"
        />
        Source labels show where each post came from. Metrics left blank stay
        unavailable — FormCraft never fabricates platform data.
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
