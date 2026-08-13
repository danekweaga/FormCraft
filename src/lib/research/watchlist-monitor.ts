import type { SupabaseClient } from "@supabase/supabase-js";
import { getProviderForPlatform } from "./discovery/registry";
import type { SearchPostResult } from "./discovery/types";
import { ingestScoredPosts } from "./ingest-posts";
import {
  BUDGETED_DISCOVERY_PROVIDERS,
  DISCOVERY_BUDGET_OPERATIONS,
  getDiscoveryBudgets,
  isDiscoveryProviderBudgeted,
  remainingDiscoveryCalls,
} from "./provider-budget";
import { filterRecentShortForm } from "./recent-short-form";

type WatchlistCreatorRow = {
  id: string;
  platform: string;
  platform_creator_id: string;
  handle: string | null;
  display_name: string | null;
  tracking_paused: boolean;
  data_freshness_at: string | null;
};

export function attachTrackedCreatorIdentity(
  posts: SearchPostResult[],
  creator: Pick<
    WatchlistCreatorRow,
    "platform_creator_id" | "display_name" | "handle"
  >,
): SearchPostResult[] {
  return posts.map((post) => ({
    ...post,
    creatorId: creator.platform_creator_id,
    creatorName: creator.display_name || creator.handle || post.creatorName,
  }));
}

export function orderWatchlistCreators<T extends WatchlistCreatorRow>(
  creators: T[],
  priorities: Map<string, number>,
): T[] {
  return [...creators].sort((a, b) => {
    const priorityDelta =
      (priorities.get(b.id) ?? 0) - (priorities.get(a.id) ?? 0);
    if (priorityDelta !== 0) return priorityDelta;
    const aFreshness = a.data_freshness_at
      ? new Date(a.data_freshness_at).getTime()
      : 0;
    const bFreshness = b.data_freshness_at
      ? new Date(b.data_freshness_at).getTime()
      : 0;
    return aFreshness - bFreshness;
  });
}

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
      .in("provider", [...BUDGETED_DISCOVERY_PROVIDERS])
      .in("operation", [...DISCOVERY_BUDGET_OPERATIONS])
      .gte("created_at", dayStart.toISOString()),
    params.supabase
      .from("provider_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", params.userId)
      .in("provider", [...BUDGETED_DISCOVERY_PROVIDERS])
      .in("operation", [...DISCOVERY_BUDGET_OPERATIONS])
      .gte("created_at", monthStart.toISOString()),
  ]);
  const remainingBudget = remainingDiscoveryCalls({
    callsToday: callsToday ?? 0,
    callsMonth: callsMonth ?? 0,
    budgets,
  });

  let creatorIds: string[];
  const creatorPriorities = new Map<string, number>();

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
      .select("external_creator_id, priority")
      .in("watchlist_id", watchlistIds);

    for (const member of members ?? []) {
      creatorPriorities.set(
        member.external_creator_id,
        Math.max(
          creatorPriorities.get(member.external_creator_id) ?? 0,
          Number(member.priority ?? 0),
        ),
      );
    }

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
    .select("id, platform, platform_creator_id, handle, display_name, tracking_paused, data_freshness_at")
    .eq("user_id", params.userId)
    .in("id", creatorIds)
    .eq("tracking_paused", false)
    .order("data_freshness_at", { ascending: true, nullsFirst: true });
  creatorsQuery = creatorsQuery.limit(Math.min(1000, creatorIds.length));
  const { data: candidateCreators } = await creatorsQuery;

  let budgetedCreators = 0;
  let skippedForBudget = 0;
  // Priority creators are checked every run. The rest continue rotating from
  // the stalest data_freshness_at value so a large imported catalog is fair.
  const orderedCandidates = orderWatchlistCreators(
    candidateCreators ?? [],
    creatorPriorities,
  );
  const creators = orderedCandidates
    .filter((creator) => {
      const provider = getProviderForPlatform(creator.platform);
      if (!provider || !isDiscoveryProviderBudgeted(provider.providerName)) {
        return true;
      }
      if (budgetedCreators >= remainingBudget) {
        skippedForBudget += 1;
        return false;
      }
      budgetedCreators += 1;
      return true;
    })
    .slice(0, requestedMaxCreators);

  const retrievedAt = new Date().toISOString();
  const allPosts: SearchPostResult[] = [];
  const usedProviders = new Set<string>();
  const byPlatform: Record<string, number> = {};
  const providerErrors: string[] = [];
  if (skippedForBudget > 0) {
    providerErrors.push(
      `${skippedForBudget} paid/quota-limited creator pull${skippedForBudget === 1 ? " was" : "s were"} deferred until the discovery budget resets; official Meta Instagram pulls remain enabled`,
    );
  }

  for (const creator of creators) {
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
      const stableCreatorPosts = attachTrackedCreatorIdentity(
        recentShorts,
        creator,
      );
      allPosts.push(...stableCreatorPosts);
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
    trustedCreatorPosts: true,
  });

  // New watchlist evidence should improve rankings even when no broad search
  // runs. Recomputing uses stored posts only and costs no provider credits.
  try {
    const { refreshCreatorSuggestionsFromLibrary } = await import(
      "./creator-suggestions"
    );
    await refreshCreatorSuggestionsFromLibrary({
      supabase: params.supabase,
      userId: params.userId,
    });
  } catch (error) {
    console.error(
      `[watchlist-monitor] creator recommendation refresh failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    creatorsChecked: creators.length,
    remainingCreators: Math.max(
      0,
      creatorIds.length - creators.length,
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
        ? "Instagram auto-pull needs Meta Business Discovery or SCRAPECREATORS_API_KEY."
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
  const stableCreatorPosts = attachTrackedCreatorIdentity(recentShorts, creator);

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
    posts: stableCreatorPosts,
    query: niche.data?.main_niche || creator.handle || creator.display_name || "creator",
    minViews: 0,
    minOutlierScore: 0,
    retrievedAt,
    trustedCreatorPosts: true,
  });

  return {
    retained: ingested.retained,
    discovered: ingested.discovered,
    provider: provider.providerName,
  };
}
