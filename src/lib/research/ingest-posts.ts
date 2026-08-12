import type { SupabaseClient } from "@supabase/supabase-js";
import type { SearchPostResult } from "./discovery/types";
import { scoreResearchOutliers } from "./outliers";
import {
  classifyCheapRelevance,
  type CheapRelevanceResult,
} from "./cheap-relevance";
import type { NicheUniverseContext } from "./content-universe";
import type { ScoredResearchVideo } from "./types";
import { cacheResearchThumbnail } from "./thumbnail-cache";

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

export function sourceLabel(providerName: string): string {
  if (providerName === "demo") return "manual_reference";
  if (
    providerName === "tiktokapi_store" ||
    providerName === "scrapecreators"
  ) {
    return "third_party_api";
  }
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

/** Only persist videos inside the saved student-tech/developer universe. */
export function retainByRelevance<
  T extends { relevance: Pick<CheapRelevanceResult, "relevant"> },
>(rows: T[]): T[] {
  return rows.filter((row) => row.relevance.relevant);
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
  const { data: profile } = await params.supabase
    .from("niche_profiles")
    .select("main_niche, topics, keywords, excluded_topics, target_audience")
    .eq("user_id", params.userId)
    .maybeSingle();
  const nicheContext: NicheUniverseContext = {
    mainNiche: profile?.main_niche,
    topics: profile?.topics,
    keywords: profile?.keywords,
    excludedTopics: profile?.excluded_topics,
    targetAudience: profile?.target_audience,
  };
  const scored = scoreResearchOutliers(unique).filter((video) => {
    if (video.views != null && video.views < minViews) return false;
    return passesOutlierMinFilter(video.outlierScore, minOutlierScore);
  });

  const withRelevance = scored.map((video) => ({
    video,
    relevance: classifyCheapRelevance(video, params.query, nicheContext),
  }));
  const retained = retainByRelevance(withRelevance);

  const durableThumbnails = new Map<string, string | null>();
  const socialRows = retained.filter(
    ({ video }) => video.platform === "tiktok" || video.platform === "instagram",
  );
  for (let index = 0; index < socialRows.length; index += 6) {
    const batch = socialRows.slice(index, index + 6);
    await Promise.all(
      batch.map(async ({ video }) => {
        const thumbnail = await cacheResearchThumbnail({
          supabase: params.supabase,
          userId: params.userId,
          platform: video.platform,
          externalId: video.externalId,
          thumbnailUrl: video.thumbnailUrl,
        });
        durableThumbnails.set(`${video.platform}:${video.externalId}`, thumbnail);
      }),
    );
  }

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
          thumbnail_url:
            durableThumbnails.get(`${video.platform}:${video.externalId}`) ??
            video.thumbnailUrl,
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
