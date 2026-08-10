import type { SupabaseClient } from "@supabase/supabase-js";
import { getProviderForPlatform } from "./discovery/registry";
import { ingestScoredPosts } from "./ingest-posts";
import {
  getDiscoveryBudgets,
  providerBudgetAllows,
} from "./provider-budget";

/**
 * Pull latest posts for tracked watchlist creators and ingest outliers.
 */
export async function runWatchlistMonitor(params: {
  supabase: SupabaseClient;
  userId: string;
  maxCreators?: number;
  postsPerCreator?: number;
  /** When set, only pull these creators (must still belong to the user). */
  externalCreatorIds?: string[];
}): Promise<{
  creatorsChecked: number;
  discovered: number;
  retained: number;
  providers: string[];
}> {
  const budgets = getDiscoveryBudgets();
  const maxCreators = Math.min(
    params.maxCreators ?? budgets.maxTrackedCreators,
    budgets.maxTrackedCreators,
  );

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

  let creatorIds: string[];

  if (params.externalCreatorIds?.length) {
    creatorIds = Array.from(new Set(params.externalCreatorIds)).slice(
      0,
      maxCreators,
    );
  } else {
    const { data: watchlists } = await params.supabase
      .from("research_watchlists")
      .select("id")
      .eq("user_id", params.userId)
      .eq("paused", false);

    const watchlistIds = (watchlists ?? []).map((w) => w.id);
    if (watchlistIds.length === 0) {
      return { creatorsChecked: 0, discovered: 0, retained: 0, providers: [] };
    }

    const { data: members } = await params.supabase
      .from("research_watchlist_members")
      .select("external_creator_id")
      .in("watchlist_id", watchlistIds);

    creatorIds = Array.from(
      new Set(
        (members ?? [])
          .map((m) => m.external_creator_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ).slice(0, maxCreators);
  }

  if (creatorIds.length === 0) {
    return { creatorsChecked: 0, discovered: 0, retained: 0, providers: [] };
  }

  const { data: creators } = await params.supabase
    .from("external_creators")
    .select("id, platform, platform_creator_id, handle, display_name, tracking_paused")
    .eq("user_id", params.userId)
    .in("id", creatorIds)
    .eq("tracking_paused", false);

  const retrievedAt = new Date().toISOString();
  const allPosts = [];
  const usedProviders = new Set<string>();

  for (const creator of creators ?? []) {
    const provider = getProviderForPlatform(creator.platform);
    if (!provider?.getCreatorPosts || !provider.capabilities().getCreatorPosts) {
      continue;
    }
    const posts = await provider.getCreatorPosts({
      platform: creator.platform as "youtube" | "tiktok" | "instagram" | "other",
      platformCreatorId: creator.platform_creator_id,
      maxResults: params.postsPerCreator ?? 10,
    });
    usedProviders.add(provider.providerName);
    allPosts.push(...posts);

    await params.supabase.from("provider_usage_events").insert({
      user_id: params.userId,
      provider: provider.providerName,
      operation: "get_creator_posts",
      result_count: posts.length,
      metadata: {
        externalCreatorId: creator.id,
        platformCreatorId: creator.platform_creator_id,
      },
    });

    await params.supabase
      .from("external_creators")
      .update({ data_freshness_at: retrievedAt })
      .eq("id", creator.id)
      .eq("user_id", params.userId);
  }

  const niche = await params.supabase
    .from("niche_profiles")
    .select("main_niche, keywords, topics")
    .eq("user_id", params.userId)
    .maybeSingle();

  const query =
    niche.data?.main_niche ||
    (niche.data?.topics ?? [])[0] ||
    (niche.data?.keywords ?? [])[0] ||
    "watchlist";

  const ingested = await ingestScoredPosts({
    supabase: params.supabase,
    userId: params.userId,
    posts: allPosts,
    query,
    minViews: 0,
    minOutlierScore: 0,
    retrievedAt,
  });

  return {
    creatorsChecked: (creators ?? []).length,
    discovered: ingested.discovered,
    retained: ingested.retained,
    providers: [...usedProviders],
  };
}

/**
 * Pull latest posts for one tracked creator (Sandcastle-style refresh).
 */
export async function refreshSingleCreatorPosts(params: {
  supabase: SupabaseClient;
  userId: string;
  externalCreatorId: string;
  maxResults?: number;
}): Promise<{
  retained: number;
  discovered: number;
  provider: string | null;
}> {
  const { data: creator } = await params.supabase
    .from("external_creators")
    .select(
      "id, platform, platform_creator_id, handle, display_name, tracking_paused",
    )
    .eq("id", params.externalCreatorId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (!creator) throw new Error("Creator not found.");
  if (creator.tracking_paused) {
    throw new Error("Tracking is paused for this creator.");
  }

  const provider = getProviderForPlatform(creator.platform);
  if (!provider?.getCreatorPosts || !provider.capabilities().getCreatorPosts) {
    throw new Error(
      creator.platform === "instagram"
        ? "Instagram auto-pull is not available."
        : `No post provider configured for ${creator.platform}.`,
    );
  }

  const retrievedAt = new Date().toISOString();
  const posts = await provider.getCreatorPosts({
    platform: creator.platform as "youtube" | "tiktok" | "instagram" | "other",
    platformCreatorId: creator.platform_creator_id,
    maxResults: params.maxResults ?? 12,
  });

  await params.supabase.from("provider_usage_events").insert({
    user_id: params.userId,
    provider: provider.providerName,
    operation: "get_creator_posts",
    result_count: posts.length,
    metadata: {
      externalCreatorId: creator.id,
      platformCreatorId: creator.platform_creator_id,
      single: true,
    },
  });

  await params.supabase
    .from("external_creators")
    .update({ data_freshness_at: retrievedAt })
    .eq("id", creator.id)
    .eq("user_id", params.userId);

  const niche = await params.supabase
    .from("niche_profiles")
    .select("main_niche")
    .eq("user_id", params.userId)
    .maybeSingle();

  const ingested = await ingestScoredPosts({
    supabase: params.supabase,
    userId: params.userId,
    posts,
    query: niche.data?.main_niche || creator.handle || creator.display_name || "creator",
    minViews: 0,
    minOutlierScore: 0,
    retrievedAt,
  });

  return {
    retained: ingested.retained,
    discovered: ingested.discovered,
    provider: provider.providerName,
  };
}
