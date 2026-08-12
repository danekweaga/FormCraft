import type { SupabaseClient } from "@supabase/supabase-js";
import { getProviderForPlatform } from "./discovery/registry";
import { ingestScoredPosts } from "./ingest-posts";
import {
  getDiscoveryBudgets,
  providerBudgetAllows,
} from "./provider-budget";
import { filterRecentShortForm } from "./recent-short-form";

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
  remainingCreators: number;
  discovered: number;
  retained: number;
  providers: string[];
  byPlatform: Record<string, number>;
  failedCreators: number;
  errors: string[];
}> {
  const budgets = getDiscoveryBudgets();
  const requestedMaxCreators =
    params.maxCreators != null && params.maxCreators > 0
      ? Math.floor(params.maxCreators)
      : 10;

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
  const maxCreators = Math.min(
    requestedMaxCreators,
    Math.max(0, budgets.dailyCalls - (callsToday ?? 0)),
    Math.max(0, budgets.monthlyCalls - (callsMonth ?? 0)),
  );

  let creatorIds: string[];

  if (params.externalCreatorIds?.length) {
    const uniqueIds = Array.from(new Set(params.externalCreatorIds));
    creatorIds = uniqueIds;
  } else {
    const { data: watchlists } = await params.supabase
      .from("research_watchlists")
      .select("id")
      .eq("user_id", params.userId)
      .eq("paused", false);

    const watchlistIds = (watchlists ?? []).map((w) => w.id);
    if (watchlistIds.length === 0) {
      return {
        creatorsChecked: 0,
        remainingCreators: 0,
        discovered: 0,
        retained: 0,
        providers: [],
        byPlatform: {},
        failedCreators: 0,
        errors: [],
      };
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
    );
  }

  if (creatorIds.length === 0) {
    return {
      creatorsChecked: 0,
      remainingCreators: 0,
      discovered: 0,
      retained: 0,
      providers: [],
      byPlatform: {},
      failedCreators: 0,
      errors: [],
    };
  }

  let creatorsQuery = params.supabase
    .from("external_creators")
    .select("id, platform, platform_creator_id, handle, display_name, tracking_paused")
    .eq("user_id", params.userId)
    .in("id", creatorIds)
    .eq("tracking_paused", false)
    .order("data_freshness_at", { ascending: true, nullsFirst: true });
  creatorsQuery = creatorsQuery.limit(maxCreators);
  const { data: creators } = await creatorsQuery;

  const retrievedAt = new Date().toISOString();
  const allPosts = [];
  const usedProviders = new Set<string>();
  const byPlatform: Record<string, number> = {};
  const providerErrors: string[] = [];

  for (const creator of creators ?? []) {
    const provider = getProviderForPlatform(creator.platform);
    if (!provider?.getCreatorPosts || !provider.capabilities().getCreatorPosts) {
      continue;
    }
    try {
      const posts = await provider.getCreatorPosts({
        platform: creator.platform as "youtube" | "tiktok" | "instagram" | "other",
        platformCreatorId: creator.platform_creator_id,
        maxResults: params.postsPerCreator ?? 30,
      });
      usedProviders.add(provider.providerName);
      const recentShorts = filterRecentShortForm(posts, { lookbackDays: 30 });
      allPosts.push(...recentShorts);
      byPlatform[creator.platform] =
        (byPlatform[creator.platform] ?? 0) + recentShorts.length;

      await params.supabase.from("provider_usage_events").insert({
        user_id: params.userId,
        provider: provider.providerName,
        operation: "get_creator_posts",
        result_count: recentShorts.length,
        metadata: {
          externalCreatorId: creator.id,
          platformCreatorId: creator.platform_creator_id,
          lookbackDays: 30,
          shortFormMaxSeconds: 180,
        },
      });

      await params.supabase
        .from("external_creators")
        .update({ data_freshness_at: retrievedAt })
        .eq("id", creator.id)
        .eq("user_id", params.userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      providerErrors.push(
        `${creator.platform} @${creator.handle || creator.platform_creator_id}: ${message}`,
      );
      console.error(
        `[watchlist-monitor] creator pull failed creator=${creator.id} platform=${creator.platform} provider=${provider.providerName}: ${message}`,
      );
    }
  }

  if (allPosts.length === 0 && providerErrors.length > 0) {
    throw new Error(providerErrors.slice(0, 3).join(" · "));
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
    remainingCreators: Math.max(
      0,
      creatorIds.length - (creators ?? []).length,
    ),
    discovered: ingested.discovered,
    retained: ingested.retained,
    providers: [...usedProviders],
    byPlatform,
    failedCreators: providerErrors.length,
    errors: providerErrors.slice(0, 5),
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
        ? "Instagram auto-pull needs SCRAPECREATORS_API_KEY."
        : `No post provider configured for ${creator.platform}.`,
    );
  }

  const retrievedAt = new Date().toISOString();
  const posts = await provider.getCreatorPosts({
    platform: creator.platform as "youtube" | "tiktok" | "instagram" | "other",
    platformCreatorId: creator.platform_creator_id,
    maxResults: params.maxResults ?? 30,
  });
  const recentShorts = filterRecentShortForm(posts, { lookbackDays: 30 });

  await params.supabase.from("provider_usage_events").insert({
    user_id: params.userId,
    provider: provider.providerName,
    operation: "get_creator_posts",
    result_count: recentShorts.length,
    metadata: {
      externalCreatorId: creator.id,
      platformCreatorId: creator.platform_creator_id,
      single: true,
      lookbackDays: 30,
      shortFormMaxSeconds: 180,
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
    posts: recentShorts,
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
