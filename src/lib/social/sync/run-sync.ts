import {
  buildRelativePerformance,
  computeBaselines,
  shouldFlagNeedsReview,
  shouldFlagWinner,
} from "@/lib/my-content/baseline";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeWindowBaselines } from "../baselines";
import { toContentPlatform } from "../content-platform";
import { sourceLabelForSynced } from "../freshness";
import { getOwnedProvider, isOwnedPlatform } from "../providers";
import { loadCredentials, storeCredentials } from "../tokens";
import type {
  PostMetrics,
  SocialConnectionRow,
  SyncProgressStep,
  TokenBundle,
} from "../types";
import { refreshExperimentMetricsFromPosts } from "./experiment-metrics";
import { updateRoadmapFromSync } from "./roadmap-metrics";

function step(
  id: string,
  label: string,
  state: SyncProgressStep["state"],
  detail?: string,
): SyncProgressStep {
  return { id, label, state, detail };
}

async function ensureFreshTokens(params: {
  connection: SocialConnectionRow;
  tokens: TokenBundle;
}): Promise<TokenBundle> {
  if (!isOwnedPlatform(params.connection.platform)) return params.tokens;
  const provider = getOwnedProvider(params.connection.platform);
  const expiresAt = params.tokens.expiresAt
    ? new Date(params.tokens.expiresAt).getTime()
    : null;
  const needsRefresh =
    expiresAt !== null && expiresAt < Date.now() + 5 * 60 * 1000;
  if (!needsRefresh || !provider.refreshAuthorization) return params.tokens;

  const refreshed = await provider.refreshAuthorization(params.tokens);
  await storeCredentials({
    connectionId: params.connection.id,
    userId: params.connection.user_id,
    tokens: refreshed,
  });
  return refreshed;
}

export async function runSocialSync(params: {
  userId: string;
  connectionId: string;
  syncType:
    | "initial_import"
    | "incremental_sync"
    | "metrics_refresh"
    | "comments_refresh"
    | "profile_refresh";
}): Promise<{ jobId: string }> {
  const admin = createAdminClient();

  const { data: connection, error: connError } = await admin
    .from("social_connections")
    .select("*")
    .eq("id", params.connectionId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (connError || !connection) {
    throw new Error(connError?.message ?? "Connection not found");
  }

  if (connection.account_type !== "owned") {
    throw new Error("Only owned accounts can sync into My Content");
  }

  if (!isOwnedPlatform(connection.platform)) {
    throw new Error("Platform adapter unavailable");
  }

  const provider = getOwnedProvider(connection.platform);
  let progress: SyncProgressStep[] = [
    step("account", "Account connected", "done"),
    step("profile", "Profile imported", "pending"),
    step("posts", "Discover posts", "pending"),
    step("metrics", "Importing performance", "pending"),
    step("classify", "Classifying content", "pending"),
    step("roadmap", "Updating creator roadmap", "pending"),
  ];

  const { data: job, error: jobError } = await admin
    .from("social_sync_jobs")
    .insert({
      user_id: params.userId,
      social_connection_id: params.connectionId,
      sync_type: params.syncType,
      status: "running",
      started_at: new Date().toISOString(),
      progress,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    throw new Error(jobError?.message ?? "Failed to create sync job");
  }

  const updateProgress = async (next: SyncProgressStep[]) => {
    progress = next;
    await admin
      .from("social_sync_jobs")
      .update({ progress: next })
      .eq("id", job.id);
  };

  const mark = async (
    id: string,
    state: SyncProgressStep["state"],
    detail?: string,
  ) => {
    const next = progress.map((s) =>
      s.id === id ? { ...s, state, detail: detail ?? s.detail } : s,
    );
    await updateProgress(next);
  };

  let recordsFound = 0;
  let recordsCreated = 0;
  let recordsUpdated = 0;

  try {
    await admin
      .from("social_connections")
      .update({ status: "syncing", last_error: null })
      .eq("id", params.connectionId)
      .eq("user_id", params.userId);

    let tokens = await loadCredentials(params.connectionId, params.userId);
    if (!tokens) throw new Error("Stored credentials missing — reconnect");

    tokens = await ensureFreshTokens({
      connection: connection as SocialConnectionRow,
      tokens,
    });

    await mark("profile", "active");
    const profile = await provider.getProfile(tokens);
    let accountInsights = null;
    if (provider.getAccountInsights) {
      try {
        accountInsights = await provider.getAccountInsights(tokens);
      } catch {
        // Account insights are supplemental. A privacy threshold or temporarily
        // unavailable metric must not block post/profile synchronization.
      }
    }
    await admin
      .from("social_connections")
      .update({
        username: profile.username,
        display_name: profile.displayName,
        avatar_url: profile.avatarUrl,
        metadata: {
          ...(connection.metadata as Record<string, unknown>),
          // Persist provider-reported count only (null when unavailable).
          follower_count: profile.followerCount,
          profile: {
            followerCount: profile.followerCount,
            ...(profile.metadata ?? {}),
          },
          ...(accountInsights ? { accountInsights } : {}),
        },
      })
      .eq("id", params.connectionId);
    await mark("profile", "done", profile.displayName ?? profile.username ?? undefined);

    if (params.syncType === "profile_refresh") {
      await mark("posts", "skipped");
      await mark("metrics", "skipped");
      await mark("classify", "skipped");
      await mark("roadmap", "active");
      await updateRoadmapFromSync({
        userId: params.userId,
        connection: connection as SocialConnectionRow,
        followerCount: profile.followerCount,
        postsPublishedDelta: 0,
        suggestOnly: true,
      });
      await mark("roadmap", "done");
    } else {
      await mark("posts", "active");
      const pages: Awaited<ReturnType<typeof provider.getPosts>>["posts"] = [];
      let cursor: string | null | undefined = null;
      const maxPages = connection.import_older_posts ? 8 : 2;
      for (let i = 0; i < maxPages; i += 1) {
        const page = await provider.getPosts(tokens, {
          cursor,
          limit: 25,
        });
        pages.push(...page.posts);
        cursor = page.nextCursor;
        if (!cursor) break;
      }
      recordsFound = pages.length;
      await mark("posts", "done", `${pages.length} posts discovered`);

      await mark("metrics", "active");
      const metricRows =
        params.syncType === "comments_refresh"
          ? []
          : await provider.getPostMetrics(
              tokens,
              pages.map((p) => p.platformPostId),
              {
                mediaTypes: Object.fromEntries(
                  pages.map((post) => [post.platformPostId, post.format]),
                ),
              },
            );
      const metricsById = new Map(metricRows.map((m) => [m.platformPostId, m]));

      const { data: existingPosts } = await admin
        .from("content_posts")
        .select(
          "id, platform, source, source_label, title, caption, published_at, views, likes, comments, shares, saves, followers_gained, is_winner, needs_review, relative_performance, created_at, external_id",
        )
        .eq("user_id", params.userId);

      const existingByExternal = new Map(
        ((existingPosts ?? []) as Array<ContentPostRow & { external_id: string | null }>)
          .filter((p) => p.external_id)
          .map((p) => [`${p.platform}:${p.external_id}`, p]),
      );

      const contentPlatform = (duration: number | null | undefined) =>
        toContentPlatform(connection.platform, duration);

      for (const post of pages) {
        const platform = contentPlatform(post.durationSeconds);
        const key = `${platform}:${post.platformPostId}`;
        const metrics: PostMetrics | undefined = metricsById.get(
          post.platformPostId,
        );
        const nowIso = new Date().toISOString();
        const sourceLabel = sourceLabelForSynced(
          connection.platform,
          nowIso,
        );

        const payload = {
          user_id: params.userId,
          platform,
          source: "connected_account" as const,
          source_label: sourceLabel,
          external_url: post.url,
          external_id: post.platformPostId,
          title: post.title,
          caption: post.caption,
          published_at: post.publishedAt,
          thumbnail_url: post.thumbnailUrl,
          duration_seconds: post.durationSeconds,
          format: post.format ?? null,
          social_connection_id: params.connectionId,
          views: metrics?.views ?? null,
          reach: metrics?.reach ?? null,
          likes: metrics?.likes ?? null,
          comments: metrics?.comments ?? null,
          shares: metrics?.shares ?? null,
          saves: metrics?.saves ?? null,
          followers_gained: metrics?.followersGained ?? null,
          watch_time_seconds: metrics?.watchTimeSeconds ?? null,
          average_view_duration_seconds:
            metrics?.averageViewDurationSeconds ?? null,
          completion_rate: metrics?.completionRate ?? null,
          profile_visits: metrics?.profileVisits ?? null,
          link_clicks: metrics?.linkClicks ?? null,
          metrics_refreshed_at: metrics ? nowIso : null,
          metadata: {
            provider_raw: post.raw ?? {},
            provider_metrics: metrics?.extra ?? {},
            data_freshness: {
              last_successful_sync_at: nowIso,
              metrics_refreshed_at: metrics ? nowIso : null,
              connection_status: "syncing",
            },
          },
        };

        const existing = existingByExternal.get(key);
        let postId: string;

        if (existing) {
          const { data: updated, error } = await admin
            .from("content_posts")
            .update(payload)
            .eq("id", existing.id)
            .eq("user_id", params.userId)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          postId = updated.id;
          recordsUpdated += 1;
        } else {
          const { data: inserted, error } = await admin
            .from("content_posts")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          postId = inserted.id;
          recordsCreated += 1;
        }

        if (metrics) {
          await admin.from("content_metric_snapshots").insert({
            user_id: params.userId,
            content_post_id: postId,
            social_connection_id: params.connectionId,
            social_sync_job_id: job.id,
            captured_at: nowIso,
            views: metrics.views,
            reach: metrics.reach,
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            saves: metrics.saves,
            followers_gained: metrics.followersGained,
            watch_time_seconds: metrics.watchTimeSeconds,
            average_view_duration_seconds: metrics.averageViewDurationSeconds,
            completion_rate: metrics.completionRate,
            profile_visits: metrics.profileVisits,
            link_clicks: metrics.linkClicks,
            extra_metrics: metrics.extra ?? {},
            metadata: { source: "social_sync", platform: connection.platform },
          });
        }
      }

      await mark(
        "metrics",
        "done",
        `${recordsCreated} created · ${recordsUpdated} updated`,
      );

      await mark("classify", "active");
      const { data: allPosts } = await admin
        .from("content_posts")
        .select(
          "id, platform, source, source_label, title, caption, published_at, views, likes, comments, shares, saves, followers_gained, is_winner, needs_review, relative_performance, created_at",
        )
        .eq("user_id", params.userId);

      const typed = (allPosts ?? []) as ContentPostRow[];
      const baselines = computeBaselines(typed);
      const recent = typed.slice(0, 30);
      const windowBaselines = computeWindowBaselines(typed, "last_30");

      for (const post of typed) {
        const relative = buildRelativePerformance(post, recent, baselines);
        const isWinner = shouldFlagWinner(post, baselines);
        const needsReview = shouldFlagNeedsReview(post, baselines);
        await admin
          .from("content_posts")
          .update({
            relative_performance: {
              ...relative,
              window_baselines: windowBaselines,
            },
            is_winner: isWinner,
            needs_review: needsReview,
            classification: {
              queued: true,
              source: "social_sync",
              note: "Heuristic classification queued — LLM deferred",
            },
          })
          .eq("id", post.id)
          .eq("user_id", params.userId);
      }
      await mark("classify", "done", "Baselines + outlier flags updated");

      if (connection.import_comments && provider.getComments) {
        try {
          const comments = await provider.getComments(
            tokens,
            pages.map((p) => p.platformPostId),
          );
          for (const comment of comments) {
            const { data: postRow } = await admin
              .from("content_posts")
              .select("id")
              .eq("user_id", params.userId)
              .eq("external_id", comment.platformPostId)
              .maybeSingle();

            await admin.from("audience_comments").insert({
              user_id: params.userId,
              post_id: postRow?.id ?? null,
              source: "connected_account",
              body: comment.body,
              metadata: {
                platform: connection.platform,
                platform_comment_id: comment.platformCommentId,
                platform_post_id: comment.platformPostId,
                published_at: comment.publishedAt,
                author_name: comment.authorName,
                author_username: comment.authorUsername,
                social_connection_id: params.connectionId,
              },
            });
          }
        } catch {
          // Comments optional — provider may not support
        }
      }

      await mark("roadmap", "active");
      await updateRoadmapFromSync({
        userId: params.userId,
        connection: connection as SocialConnectionRow,
        followerCount: profile.followerCount,
        postsPublishedDelta: recordsCreated,
        suggestOnly: true,
      });
      await refreshExperimentMetricsFromPosts({
        userId: params.userId,
      });
      await mark("roadmap", "done");
    }

    const nextSync = new Date(
      Date.now() + connection.sync_frequency_hours * 60 * 60 * 1000,
    ).toISOString();

    await admin
      .from("social_connections")
      .update({
        status: "connected",
        last_synced_at: new Date().toISOString(),
        last_successful_sync_at: new Date().toISOString(),
        next_scheduled_sync_at: connection.auto_sync_enabled ? nextSync : null,
        last_error: null,
      })
      .eq("id", params.connectionId);

    await admin
      .from("social_sync_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        records_found: recordsFound,
        records_created: recordsCreated,
        records_updated: recordsUpdated,
        progress,
      })
      .eq("id", job.id);

    return { jobId: job.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await admin
      .from("social_connections")
      .update({
        status: "needs_attention",
        last_error: message,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", params.connectionId);

    await admin
      .from("social_sync_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_code: "sync_failed",
        error_message: message,
        records_found: recordsFound,
        records_created: recordsCreated,
        records_updated: recordsUpdated,
        progress: progress.map((s) =>
          s.state === "active" ? { ...s, state: "error", detail: message } : s,
        ),
      })
      .eq("id", job.id);

    throw error;
  }
}
