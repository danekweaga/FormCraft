import type { SupabaseClient } from "@supabase/supabase-js";
import type { SearchPostResult } from "./discovery/types";
import { scoreResearchOutliers } from "./outliers";
import {
  classifyCheapRelevance,
  classifyCheapRelevanceBatch,
  type CheapRelevanceResult,
} from "./cheap-relevance";
import type { ScoredResearchVideo } from "./types";

export function dedupeSearchPosts(posts: SearchPostResult[]): SearchPostResult[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    const key = `${post.platform}:${post.externalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function upsertExternalCreator(
  supabase: SupabaseClient,
  userId: string,
  video: {
    platform: string;
    creatorId: string | null;
    creatorName: string | null;
    creatorFollowerCount?: number | null;
    providerName: string;
    retrievedAt: string;
  },
): Promise<string | null> {
  if (!video.creatorId) return null;
  const { data, error } = await supabase
    .from("external_creators")
    .upsert(
      {
        user_id: userId,
        platform: video.platform,
        platform_creator_id: video.creatorId,
        display_name: video.creatorName,
        handle: video.creatorName,
        follower_count: video.creatorFollowerCount ?? null,
        data_source: video.providerName,
        data_freshness_at: video.retrievedAt,
      },
      { onConflict: "user_id,platform,platform_creator_id" },
    )
    .select("id")
    .single();
  if (error) return null;
  return data?.id ?? null;
}

function sourceLabel(providerName: string): string {
  if (providerName === "demo") return "manual_reference";
  if (providerName === "tiktokapi_store") return "third_party_api";
  return "official_api";
}

export function passesOutlierMinFilter(
  outlierScore: number | null | undefined,
  minOutlierScore: number,
): boolean {
  // Unscored posts (no baseline yet) must not be treated as 0 — that emptied first pulls.
  if (outlierScore == null) return true;
  return outlierScore >= minOutlierScore;
}

export async function ingestScoredPosts(params: {
  supabase: SupabaseClient;
  userId: string;
  posts: SearchPostResult[];
  query: string;
  researchScanId?: string | null;
  minViews?: number;
  minOutlierScore?: number;
  retrievedAt?: string;
}): Promise<{ discovered: number; retained: number }> {
  const retrievedAt = params.retrievedAt ?? new Date().toISOString();
  const unique = dedupeSearchPosts(params.posts);
  const minViews = params.minViews ?? 0;
  const minOutlierScore = params.minOutlierScore ?? 0;
  const scored = scoreResearchOutliers(unique).filter((video) => {
    if ((video.views ?? 0) < minViews) return false;
    return passesOutlierMinFilter(video.outlierScore, minOutlierScore);
  });

  const relevanceById = await classifyCheapRelevanceBatch({
    supabase: params.supabase,
    userId: params.userId,
    query: params.query,
    items: scored,
  });

  const withRelevance = scored.map((video) => ({
    video,
    relevance:
      relevanceById.get(`${video.platform}:${video.externalId}`) ??
      classifyCheapRelevance(video, params.query),
  }));
  const relevantCount = withRelevance.filter((r) => r.relevance.relevant).length;
  const retained =
    relevantCount >= 3
      ? withRelevance.filter((r) => r.relevance.relevant)
      : withRelevance;

  for (const { video, relevance } of retained) {
    const providerMeta = unique.find((u) => u.externalId === video.externalId);
    const creatorId = await upsertExternalCreator(params.supabase, params.userId, {
      platform: video.platform,
      creatorId: video.creatorId,
      creatorName: video.creatorName,
      creatorFollowerCount: providerMeta?.creatorFollowerCount,
      providerName: providerMeta?.providerName ?? "unknown",
      retrievedAt: providerMeta?.retrievedAt ?? retrievedAt,
    });

    const { data: upserted, error: upsertError } = await params.supabase
      .from("research_items")
      .upsert(
        {
          user_id: params.userId,
          research_scan_id: params.researchScanId ?? null,
          platform: video.platform,
          external_id: video.externalId,
          external_url: video.externalUrl,
          creator_id: video.creatorId,
          creator_name: video.creatorName,
          external_creator_id: creatorId,
          title: video.title,
          description: video.description,
          thumbnail_url: video.thumbnailUrl,
          published_at: video.publishedAt,
          duration_seconds: video.durationSeconds,
          views: video.views,
          likes: video.likes,
          comments: video.comments,
          shares: video.shares,
          creator_followers: providerMeta?.creatorFollowerCount ?? null,
          baseline_views: video.baselineViews,
          outlier_score: video.outlierScore,
          score_basis: video.scoreBasis,
          outlier_label: video.outlierLabel ?? null,
          baseline_confidence: video.baselineConfidence ?? null,
          baseline_sample_size: video.baselineSampleSize ?? null,
          data_freshness_at: providerMeta?.retrievedAt ?? retrievedAt,
          topic: relevance.topic || params.query,
          personal_relevance_score: relevance.relevant ? 1 : 0,
          source: sourceLabel(providerMeta?.providerName ?? "unknown"),
          collection_method: providerMeta?.collectionMethod ?? "search",
          discovered_at: retrievedAt,
        },
        { onConflict: "user_id,platform,external_id" },
      )
      .select("id")
      .single();

    if (upsertError) throw new Error(upsertError.message);

    if (upserted?.id) {
      await params.supabase.from("external_metric_snapshots").insert({
        user_id: params.userId,
        research_item_id: upserted.id,
        captured_at: retrievedAt,
        views: video.views,
        likes: video.likes,
        comments: video.comments,
        shares: video.shares,
        follower_count: providerMeta?.creatorFollowerCount ?? null,
        data_source: providerMeta?.providerName ?? "unknown",
      });
    }
  }

  return { discovered: unique.length, retained: retained.length };
}

export type { ScoredResearchVideo, CheapRelevanceResult };
