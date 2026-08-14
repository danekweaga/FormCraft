import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getConfiguredDiscoveryProviders,
  getProviderForPlatform,
} from "./discovery/registry";
import {
  getScrapeCreatorsUsage,
  resetScrapeCreatorsUsage,
  scrapeCreatorsCreditWarning,
} from "./discovery/scrapecreators-client";
import type { SearchPostResult } from "./discovery/types";
import { ingestScoredPosts } from "./ingest-posts";
import {
  BUDGETED_DISCOVERY_PROVIDERS,
  DISCOVERY_BUDGET_OPERATIONS,
  getDiscoveryBudgets,
  isDiscoveryProviderBudgeted,
  providerBudgetAllows,
  remainingDiscoveryCalls,
} from "./provider-budget";
import {
  inferPlatformFromHandle,
  resolvePlatformCreatorId,
} from "./resolve-creator";
import { filterRecentShortForm } from "./recent-short-form";
import { nextDailyResearchRunAt } from "./scan-schedule";
import { interleaveCreatorTargets } from "./fair-creator-targets";

type ResearchScanRow = {
  id: string;
  user_id: string;
  query: string;
  platforms: string[];
  lookback_days: number;
  min_views: number;
  min_outlier_score: number;
  max_results: number;
  parameters: Record<string, unknown> | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

/**
 * Niche discovery scan. Calculates outliers locally.
 * Does NOT run deep AI analysis automatically.
 *
 * When creatorIds / channelHandles are set on scan.parameters, prefers
 * getCreatorPosts for those channels and skips broad searchPosts.
 */
export async function runResearchScan(params: {
  supabase: SupabaseClient;
  userId: string;
  scanId: string;
  /** Manual pulls stay small; the five-minute cron can rotate through more. */
  maxCreatorTargets?: number;
}): Promise<{
  discovered: number;
  eligible: number;
  retained: number;
  providers: string[];
  notes: string[];
}> {
  const { data, error } = await params.supabase
    .from("research_scans")
    .select(
      "id, user_id, query, platforms, lookback_days, min_views, min_outlier_score, max_results, parameters",
    )
    .eq("id", params.scanId)
    .eq("user_id", params.userId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Research scan not found");

  const scan = data as ResearchScanRow;
  const parameters =
    scan.parameters && typeof scan.parameters === "object"
      ? scan.parameters
      : {};
  const creatorIds = asStringArray(parameters.creatorIds);
  const channelHandles = asStringArray(parameters.channelHandles);
  const targetCreators = creatorIds.length > 0 || channelHandles.length > 0;

  const searchProviders = getConfiguredDiscoveryProviders().filter(
    (p) =>
      p.capabilities().searchPosts &&
      p.capabilities().platforms.some((plat) => scan.platforms.includes(plat)),
  );

  if (!targetCreators && searchProviders.length === 0) {
    throw new Error(
      "No configured discovery provider supports the selected platforms. Set the official platform key, META_BUSINESS_DISCOVERY_ACCESS_TOKEN + META_BUSINESS_DISCOVERY_IG_USER_ID for Instagram watchlists, SCRAPECREATORS_API_KEY for broad TikTok/Instagram search, or enable RESEARCH_ENABLE_DEMO.",
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
  const budget = providerBudgetAllows({
    callsToday: callsToday ?? 0,
    callsMonth: callsMonth ?? 0,
    budgets,
  });
  if (!targetCreators && !budget.ok) throw new Error(budget.message);

  try {
    resetScrapeCreatorsUsage();
    const retrievedAt = new Date().toISOString();
    const maxResults = Math.min(scan.max_results, budgets.maxResultsPerQuery);
    const usedProviders = new Set<string>();
    const discovered: SearchPostResult[] = [];
    const providerErrors: string[] = [];
    const providerNotes: string[] = [];

    if (targetCreators) {
      const { data: tracked } = creatorIds.length
        ? await params.supabase
            .from("external_creators")
            .select(
              "id, platform, platform_creator_id, handle, data_freshness_at",
            )
            .eq("user_id", params.userId)
            .in("id", creatorIds)
            .order("data_freshness_at", {
              ascending: true,
              nullsFirst: true,
            })
        : { data: [] as Array<{
            id: string;
            platform: string;
            platform_creator_id: string;
            handle: string | null;
            data_freshness_at: string | null;
          }> };

      const targets: Array<{
        platform: string;
        platformCreatorId: string;
        externalCreatorId: string | null;
      }> = (tracked ?? []).map((c) => ({
        platform: c.platform,
        platformCreatorId: c.platform_creator_id,
        externalCreatorId: c.id,
      }));

      for (const handle of channelHandles) {
        const platform = inferPlatformFromHandle(handle, scan.platforms);
        if (!platform) continue;
        const platformCreatorId = await resolvePlatformCreatorId({
          platform,
          handle,
        });
        if (!platformCreatorId) continue;
        const { data: upsertedCreator } = await params.supabase
          .from("external_creators")
          .upsert(
            {
              user_id: params.userId,
              platform,
              platform_creator_id: platformCreatorId,
              handle: handle.replace(/^@/, ""),
              display_name: handle.replace(/^@/, ""),
              data_source:
                platform === "youtube" ? "official_api" : "third_party_api",
            },
            { onConflict: "user_id,platform,platform_creator_id" },
          )
          .select("id")
          .single();
        targets.push({
          platform,
          platformCreatorId,
          externalCreatorId: upsertedCreator?.id ?? null,
        });
      }

      const allUniqueTargets = Array.from(
        new Map(
          targets.map((t) => [`${t.platform}:${t.platformCreatorId}`, t]),
        ).values(),
      )
        .filter((target) => {
          if (
            scan.platforms.length > 0 &&
            !scan.platforms.includes(target.platform)
          ) {
            return false;
          }
          const provider = getProviderForPlatform(target.platform);
          return Boolean(
            provider?.getCreatorPosts &&
              provider.capabilities().getCreatorPosts,
          );
        });

      // A server action has a 60-second window and each creator profile costs
      // at least one provider request. Manual pulls stay at ten; the scheduled
      // five-minute route can rotate through a larger batch.
      const remainingBudget = remainingDiscoveryCalls({
        callsToday: callsToday ?? 0,
        callsMonth: callsMonth ?? 0,
        budgets,
      });
      let budgetedTargets = 0;
      const requestedCreatorLimit = Math.min(
        100,
        Math.max(1, params.maxCreatorTargets ?? 10),
      );
      const fairTargets = interleaveCreatorTargets(
        allUniqueTargets,
        scan.platforms,
      );
      const uniqueTargets = fairTargets
        .filter((target) => {
          const provider = getProviderForPlatform(target.platform);
          if (!provider || !isDiscoveryProviderBudgeted(provider.providerName)) {
            return true;
          }
          if (budgetedTargets >= remainingBudget) return false;
          budgetedTargets += 1;
          return true;
        })
        .slice(0, requestedCreatorLimit);

      if (uniqueTargets.length === 0) {
        if (!budget.ok) throw new Error(budget.message);
        throw new Error("No supported creators were selected for this pull.");
      }

      for (const target of uniqueTargets) {
        const provider = getProviderForPlatform(target.platform);
        if (
          !provider?.getCreatorPosts ||
          !provider.capabilities().getCreatorPosts
        ) {
          continue;
        }
        try {
          const posts = await provider.getCreatorPosts({
            platform: target.platform as
              | "youtube"
              | "tiktok"
              | "instagram"
              | "other",
            platformCreatorId: target.platformCreatorId,
            maxResults: Math.min(15, maxResults),
          });
          usedProviders.add(provider.providerName);
          discovered.push(...posts);
          await params.supabase.from("provider_usage_events").insert({
            user_id: params.userId,
            provider: provider.providerName,
            operation: "get_creator_posts",
            result_count: posts.length,
            metadata: {
              scanId: scan.id,
              platform: target.platform,
              platformCreatorId: target.platformCreatorId,
            },
          });
          if (posts.length === 0) {
            providerNotes.push(
              `${provider.providerName}: 0 results for ${target.platformCreatorId}`,
            );
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          providerErrors.push(`${provider.providerName}: ${message}`);
          console.error(
            `[research-scan] creator pull failed platform=${target.platform} provider=${provider.providerName}: ${message}`,
          );
        } finally {
          // Advance the stale-first queue even when a creator has no recent
          // posts or the provider fails. Otherwise one broken creator is
          // selected every day and starves Instagram/TikTok creators below it.
          if (target.externalCreatorId) {
            await params.supabase
              .from("external_creators")
              .update({ data_freshness_at: retrievedAt })
              .eq("id", target.externalCreatorId)
              .eq("user_id", params.userId);
          }
        }
      }

      if (allUniqueTargets.length > uniqueTargets.length) {
        providerNotes.push(
          `Checked ${uniqueTargets.length} of ${allUniqueTargets.length} selected creators now; the daily scanner will continue with the next ${Math.min(requestedCreatorLimit, allUniqueTargets.length - uniqueTargets.length)} stale creators automatically`,
        );
      }

      if (discovered.length === 0 && providerErrors.length > 0) {
        throw new Error(providerErrors.join(" · "));
      }
    } else {
      const settled = await Promise.allSettled(
        searchProviders.map(async (provider) => {
          const posts = await provider.searchPosts({
            query: scan.query,
            platforms: scan.platforms as Array<
              "youtube" | "instagram" | "tiktok"
            >,
            lookbackDays: scan.lookback_days,
            maxResults,
            minViews: 0,
          });
          return { provider, posts };
        }),
      );

      for (let i = 0; i < settled.length; i++) {
        const result = settled[i]!;
        const provider = searchProviders[i]!;
        if (result.status === "fulfilled") {
          const { posts } = result.value;
          usedProviders.add(provider.providerName);
          discovered.push(...posts);
          await params.supabase.from("provider_usage_events").insert({
            user_id: params.userId,
            provider: provider.providerName,
            operation: "search_posts",
            result_count: posts.length,
            metadata: { scanId: scan.id, query: scan.query },
          });
          if (posts.length === 0) {
            providerNotes.push(`${provider.providerName}: 0 results`);
          }
        } else {
          const message =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          providerErrors.push(`${provider.providerName}: ${message}`);
          console.error(
            `[research-scan] provider search failed provider=${provider.providerName}: ${message}`,
          );
        }
      }

      if (discovered.length === 0 && providerErrors.length > 0) {
        throw new Error(providerErrors.join(" · "));
      }
    }

    const eligiblePosts = filterRecentShortForm(discovered, {
      lookbackDays: scan.lookback_days,
    });
    const ingested = await ingestScoredPosts({
      supabase: params.supabase,
      userId: params.userId,
      posts: eligiblePosts,
      query: scan.query,
      researchScanId: scan.id,
      minViews: scan.min_views,
      minOutlierScore: scan.min_outlier_score,
      retrievedAt,
      trustedCreatorPosts: targetCreators,
    });

    // Re-rank the user's pending creator recommendations whenever the real
    // discovery library changes. This does not spend another provider credit.
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
        `[research-scan] creator recommendation refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const now = new Date();
    const nextRun = nextDailyResearchRunAt(now);
    const byPlatform = discovered.reduce<Record<string, number>>((acc, post) => {
      acc[post.platform] = (acc[post.platform] ?? 0) + 1;
      return acc;
    }, {});
    const scUsage = getScrapeCreatorsUsage();
    const creditWarning = scrapeCreatorsCreditWarning(
      scUsage.creditsRemaining,
      scUsage.exhausted,
    );
    const notes = [creditWarning, ...providerNotes, ...providerErrors]
      .filter(Boolean)
      .map(String);
    const lastRunStats = {
      discovered: discovered.length,
      eligible: eligiblePosts.length,
      retained: ingested.retained,
      providers: [...usedProviders],
      by_platform: byPlatform,
      provider_errors: providerErrors,
      provider_notes: notes,
      at: now.toISOString(),
      scrapecreators: {
        credits_remaining: scUsage.creditsRemaining,
        credits_charged: scUsage.creditsChargedThisSession,
        exhausted: scUsage.exhausted,
      },
    };
    await params.supabase
      .from("research_scans")
      .update({
        status: "active",
        last_run_at: now.toISOString(),
        next_run_at: nextRun.toISOString(),
        // A completed partial pull is not a failed scan. Notes remain visible
        // in last_run_stats without leaving the radar in a red error state.
        last_error: null,
        parameters: {
          ...parameters,
          last_run_stats: lastRunStats,
        },
      })
      .eq("id", scan.id)
      .eq("user_id", params.userId);

    return {
      discovered: discovered.length,
      eligible: eligiblePosts.length,
      retained: ingested.retained,
      providers: [...usedProviders],
      notes,
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
