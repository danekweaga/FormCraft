import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeBaselines,
  getRelativeMultiplier,
  getRelativeRank,
} from "@/lib/my-content/baseline";
import { buildPostPerformanceInsights } from "@/lib/my-content/performance";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import { PostDetailClient } from "./post-detail";

const POST_FIELDS =
  "id, platform, source, source_label, external_url, thumbnail_url, title, caption, format, published_at, views, reach, likes, comments, shares, saves, followers_gained, watch_time_seconds, average_view_duration_seconds, completion_rate, profile_visits, link_clicks, is_winner, needs_review, relative_performance, metrics_refreshed_at, social_connection_id, created_at";

export default async function MyContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: post } = await supabase
    .from("content_posts")
    .select(POST_FIELDS)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!post) notFound();

  const { data: latestSnapshot } = await supabase
    .from("content_metric_snapshots")
    .select("extra_metrics")
    .eq("content_post_id", id)
    .eq("user_id", user.id)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: recent } = await supabase
    .from("content_posts")
    .select(POST_FIELDS)
    .eq("user_id", user.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const recentPosts = (recent ?? []) as ContentPostRow[];
  const baselines = computeBaselines(recentPosts);
  const typedPost = post as ContentPostRow;

  return (
    <PostDetailClient
      post={typedPost}
      performanceInsights={buildPostPerformanceInsights(
        typedPost,
        recentPosts.slice(0, 10),
      )}
      viewsRank={getRelativeRank(typedPost, recentPosts.slice(0, 10), "views")}
      viewsMultiplier={getRelativeMultiplier(typedPost, baselines, "views")}
      providerMetrics={
        latestSnapshot?.extra_metrics &&
        typeof latestSnapshot.extra_metrics === "object"
          ? (latestSnapshot.extra_metrics as Record<string, unknown>)
          : {}
      }
    />
  );
}
