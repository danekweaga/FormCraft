import { createAdminClient } from "@/lib/supabase/admin";
import type { SocialConnectionRow } from "../types";
import { followerProgress, inferFollowerTarget, readFollowerGoal } from "@/lib/growth/follower-goal";

/**
 * Updates supported numeric roadmap metrics from sync.
 * Strategic milestone changes are suggestions only (require user approval later).
 */
export async function updateRoadmapFromSync(params: {
  userId: string;
  connection: SocialConnectionRow;
  followerCount: number | null;
  postsPublishedDelta: number;
  suggestOnly: boolean;
}) {
  if (!params.connection.use_for_roadmap) return;

  const admin = createAdminClient();
  const { data: roadmaps } = await admin
    .from("creator_roadmaps")
    .select("id, goal, metadata, status")
    .eq("user_id", params.userId)
    .eq("status", "active")
    .limit(5);

  if (!roadmaps?.length) return;

  const { data: roadmapAccounts } = await admin
    .from("social_connections")
    .select("id, platform")
    .eq("user_id", params.userId)
    .eq("account_type", "owned")
    .eq("use_for_roadmap", true)
    .neq("status", "disconnected");
  const automaticConnectionId = roadmapAccounts?.find((account) => account.platform === "instagram")?.id
    ?? roadmapAccounts?.[0]?.id
    ?? params.connection.id;

  const { count: postsPublished } = await admin
    .from("content_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .eq("social_connection_id", params.connection.id);

  for (const roadmap of roadmaps) {
    const savedGoal = readFollowerGoal(roadmap.metadata);
    const inferredTarget = savedGoal?.target ?? inferFollowerTarget(roadmap.goal);
    // Avoid binding an unconfigured goal to whichever provider finishes syncing first.
    const tracksThisConnection = savedGoal?.connectionId
      ? savedGoal.connectionId === params.connection.id
      : automaticConnectionId === params.connection.id;
    const goal = inferredTarget ? {
      target: inferredTarget,
      current: savedGoal?.current ?? null,
      connectionId: savedGoal?.connectionId ?? automaticConnectionId,
      updatedAt: savedGoal?.updatedAt ?? null,
    } : null;
    const goalUpdate = goal && tracksThisConnection && params.followerCount != null ? {
      follower_goal: { ...goal, current: params.followerCount, connectionId: params.connection.id, updatedAt: new Date().toISOString() },
    } : {};
    const metadata = {
      ...((roadmap.metadata as Record<string, unknown>) ?? {}),
      ...goalUpdate,
      synced_metrics: {
        platform: params.connection.platform,
        connection_id: params.connection.id,
        follower_count: params.followerCount,
        posts_published: postsPublished ?? 0,
        posts_published_delta: params.postsPublishedDelta,
        updated_at: new Date().toISOString(),
      },
    };

    const { error: updateError } = await admin
      .from("creator_roadmaps")
      .update({ metadata, ...(goal && tracksThisConnection && params.followerCount != null ? { progress_pct: followerProgress(params.followerCount, goal.target) } : {}) })
      .eq("id", roadmap.id)
      .eq("user_id", params.userId);
    if (updateError) throw updateError;

    const { data: milestones } = await admin
      .from("roadmap_milestones")
      .select("id, title, category, current_value, target_value, source_kind")
      .eq("roadmap_id", roadmap.id)
      .eq("user_id", params.userId);

    for (const milestone of milestones ?? []) {
      const category = (milestone.category ?? "").toLowerCase();
      const title = (milestone.title ?? "").toLowerCase();
      let nextValue: number | null = null;

      if (
        category.includes("follower") ||
        title.includes("follower") ||
        title.includes("subscriber")
      ) {
        nextValue = tracksThisConnection ? params.followerCount : null;
      } else if (
        category.includes("post") ||
        title.includes("publish") ||
        title.includes("posting")
      ) {
        nextValue = postsPublished ?? 0;
      }

      if (nextValue === null) continue;

      await admin
        .from("roadmap_milestones")
        .update({
          current_value: nextValue,
          source_kind: "auto",
          evidence: {
            auto_updated: true,
            connection_id: params.connection.id,
            platform: params.connection.platform,
            note: params.suggestOnly
              ? "Metric value updated from sync. Strategic milestone changes still require approval."
              : "Updated from social sync",
          },
        })
        .eq("id", milestone.id)
        .eq("user_id", params.userId);
    }

    await admin.from("roadmap_updates").insert({
      user_id: params.userId,
      roadmap_id: roadmap.id,
      summary: `Synced ${params.connection.platform} metrics into roadmap progress (followers/posts where mapped).`,
      source_kind: "auto",
      details: {
        suggest_strategic_changes: true,
        message:
          "FormCraft can suggest strategic roadmap changes after sync, but will not auto-alter milestones without approval.",
        follower_count: params.followerCount,
        posts_published: postsPublished ?? 0,
      },
    });
  }
}
