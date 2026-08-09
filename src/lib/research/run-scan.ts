import type { SupabaseClient } from "@supabase/supabase-js";
import { getConfiguredDiscoveryProviders } from "./discovery/registry";
import { scoreResearchOutliers } from "./outliers";
import { classifyCheapRelevance } from "./cheap-relevance";
import {
  getDiscoveryBudgets,
  providerBudgetAllows,
} from "./provider-budget";

type ResearchScanRow = {
  id: string;
  user_id: string;
  query: string;
  platforms: string[];
  lookback_days: number;
  min_views: number;
  min_outlier_score: number;
  max_results: number;
};

async function upsertCreator(
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

/**
 * Niche discovery scan. Calculates outliers locally.
 * Does NOT run deep AI analysis automatically (Growth H cost control).
 */
export async function runResearchScan(params: {
  supabase: SupabaseClient;
  userId: string;
  scanId: string;
}): Promise<{ discovered: number; retained: number; providers: string[] }> {
  const { data, error } = await params.supabase
    .from("research_scans")
    .select(
      "id, user_id, query, platforms, lookback_days, min_views, min_outlier_score, max_results",
    )
    .eq("id", params.scanId)
    .eq("user_id", params.userId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Research scan not found");

  const scan = data as ResearchScanRow;
  const providers = getConfiguredDiscoveryProviders().filter((p) =>
    p.capabilities().platforms.some((plat) => scan.platforms.includes(plat)),
  );

  if (providers.length === 0) {
    throw new Error(
      "No configured discovery provider supports the selected platforms. Set YOUTUBE_DATA_API_KEY or use demo in development.",
    );
  }

  const budgets = getDiscoveryBudgets();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(
    Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), 1),
  );
  const [{ count: callsToday }, { count: callsMonth }] = await Promise.all([
    params.supabase
      .from("provider_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", params.userId)
      .gte("created_at", dayStart.toISOString()),
    params.supabase
      .from("provider_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", params.userId)
      .gte("created_at", monthStart.toISOString()),
  ]);
  const budget = providerBudgetAllows({
    callsToday: callsToday ?? 0,
    callsMonth: callsMonth ?? 0,
    budgets,
  });
  if (!budget.ok) throw new Error(budget.message);

  try {
    const retrievedAt = new Date().toISOString();
    const maxResults = Math.min(scan.max_results, budgets.maxResultsPerQuery);
    const discoveredBatches = await Promise.all(
      providers.map((provider) =>
        provider.searchPosts({
          query: scan.query,
          platforms: scan.platforms as Array<"youtube" | "instagram" | "tiktok">,
          lookbackDays: scan.lookback_days,
          maxResults,
          minViews: scan.min_views,
        }),
      ),
    );
    const discovered = discoveredBatches.flat();

    // Deduplicate by platform+externalId
    const seen = new Set<string>();
    const unique = discovered.filter((post) => {
      const key = `${post.platform}:${post.externalId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const scored = scoreResearchOutliers(unique).filter(
      (video) =>
        (video.views ?? 0) >= scan.min_views &&
        (video.outlierScore ?? 0) >= Number(scan.min_outlier_score),
    );
    const withRelevance = scored.map((video) => ({
      video,
      relevance: classifyCheapRelevance(video, scan.query),
    }));
    const relevantCount = withRelevance.filter((r) => r.relevance.relevant).length;
    // Prefer relevant posts; only hard-drop weak matches when enough remain.
    const retained =
      relevantCount >= 3
        ? withRelevance.filter((r) => r.relevance.relevant)
        : withRelevance;

    for (const { video, relevance } of retained) {
      const providerMeta = unique.find((u) => u.externalId === video.externalId);
      const creatorId = await upsertCreator(params.supabase, params.userId, {
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
            research_scan_id: scan.id,
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
            hook_text: video.title,
            topic: relevance.topic || scan.query,
            personal_relevance_score: relevance.relevant ? 1 : 0,
            source:
              providerMeta?.providerName === "demo"
                ? "manual_reference"
                : "official_api",
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

    for (const provider of providers) {
      await params.supabase.from("provider_usage_events").insert({
        user_id: params.userId,
        provider: provider.providerName,
        operation: "search_posts",
        result_count: discovered.filter(
          (d) => d.providerName === provider.providerName,
        ).length,
        metadata: { scanId: scan.id, query: scan.query },
      });
    }

    const now = new Date();
    const nextRun = new Date(now.getTime() + 86_400_000);
    await params.supabase
      .from("research_scans")
      .update({
        status: "active",
        last_run_at: now.toISOString(),
        next_run_at: nextRun.toISOString(),
        last_error: null,
      })
      .eq("id", scan.id)
      .eq("user_id", params.userId);

    return {
      discovered: unique.length,
      retained: retained.length,
      providers: providers.map((p) => p.providerName),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Research scan failed";
    await params.supabase
      .from("research_scans")
      .update({ status: "needs_attention", last_error: message.slice(0, 500) })
      .eq("id", scan.id)
      .eq("user_id", params.userId);
    throw error;
  }
}
