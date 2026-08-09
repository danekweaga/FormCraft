import { createAdminClient } from "@/lib/supabase/admin";

/**
 * When experiments have attached post_ids, refresh experiment.metrics
 * from the latest content_posts values (no manual re-entry required).
 */
export async function refreshExperimentMetricsFromPosts(params: {
  userId: string;
}) {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("content_experiments")
    .select("id, post_ids, primary_metric, status, metrics")
    .eq("user_id", params.userId)
    .in("status", ["planned", "running", "completed"]);

  for (const experiment of rows ?? []) {
    const postIds = (experiment.post_ids ?? []) as string[];
    if (postIds.length === 0) continue;

    const { data: posts } = await admin
      .from("content_posts")
      .select(
        "id, views, likes, comments, shares, saves, followers_gained, metrics_refreshed_at, source, social_connection_id",
      )
      .eq("user_id", params.userId)
      .in("id", postIds);

    if (!posts?.length) continue;

    const sum = (key: "views" | "likes" | "comments" | "shares" | "saves") => {
      const values = posts
        .map((p) => p[key])
        .filter((v): v is number => typeof v === "number");
      if (values.length === 0) return null;
      return values.reduce((a, b) => a + b, 0);
    };

    const metrics = {
      ...(typeof experiment.metrics === "object" && experiment.metrics
        ? (experiment.metrics as Record<string, unknown>)
        : {}),
      synced_from_posts: {
        post_count: posts.length,
        views: sum("views"),
        likes: sum("likes"),
        comments: sum("comments"),
        shares: sum("shares"),
        saves: sum("saves"),
        primary_metric: experiment.primary_metric,
        refreshed_at: new Date().toISOString(),
        freshest_post_metric_at:
          posts
            .map((p) => p.metrics_refreshed_at)
            .filter(Boolean)
            .sort()
            .at(-1) ?? null,
      },
    };

    await admin
      .from("content_experiments")
      .update({ metrics })
      .eq("id", experiment.id)
      .eq("user_id", params.userId);
  }
}

export async function attachPostToExperiment(params: {
  userId: string;
  experimentId: string;
  postId: string;
}) {
  const admin = createAdminClient();
  const { data: experiment, error } = await admin
    .from("content_experiments")
    .select("id, post_ids")
    .eq("id", params.experimentId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error || !experiment) {
    throw new Error(error?.message ?? "Experiment not found");
  }

  const { data: post } = await admin
    .from("content_posts")
    .select("id")
    .eq("id", params.postId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (!post) throw new Error("Post not found");

  const postIds = Array.from(
    new Set([...(experiment.post_ids as string[]), params.postId]),
  );

  const { error: updateError } = await admin
    .from("content_experiments")
    .update({ post_ids: postIds })
    .eq("id", params.experimentId)
    .eq("user_id", params.userId);

  if (updateError) throw new Error(updateError.message);

  await refreshExperimentMetricsFromPosts({ userId: params.userId });
}
