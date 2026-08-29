import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getConfiguredDiscoveryProviders,
  getProviderForPlatform,
} from "./discovery/registry";
import {
  captureScrapeCreatorsUsage,
  getScrapeCreatorsUsage,
  resetScrapeCreatorsUsage,
  scrapeCreatorsCreditsChargedFromError,
  scrapeCreatorsCreditWarning,
} from "./discovery/scrapecreators-client";
import type { SearchPostResult } from "./discovery/types";
import { ingestScoredPosts } from "./ingest-posts";
import {
  BUDGETED_DISCOVERY_PROVIDERS,
  DISCOVERY_BUDGET_OPERATIONS,
  countDiscoveryUsageByPlatform,
  getDiscoveryBudgets,
  getDiscoveryBudgetsForPlatform,
  isBudgetedDiscoveryPlatform,
  isDiscoveryProviderBudgeted,
  providerBudgetAllows,
  remainingDiscoveryCallsByPlatform,
} from "./provider-budget";
import {
  inferPlatformFromHandle,
  resolvePlatformCreatorId,
} from "./resolve-creator";
import { filterRecentShortForm } from "./recent-short-form";
import {
  incrementalLookbackDays,
  keepPostsPostedSince,
  nextDailyResearchRunAt,
  postedSinceCutoff,
} from "./scan-schedule";
import { interleaveCreatorTargets } from "./fair-creator-targets";
import { nextDiscoveryQueryBatch } from "./discovery-angles";

type ResearchScanRow = {
  id: string;
  user_id: string;
  query: string;
  platforms: string[];
  lookback_days: number;
  min_views: number;
  min_outlier_score: number;
  max_results: number;
  last_run_at: string | null;
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
      "id, user_id, query, platforms, lookback_days, min_views, min_outlier_score, max_results, last_run_at, parameters",
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
  const creatorIds =
    parameters.discoveryMode === "niche_search"
      ? []
      : asStringArray(parameters.creatorIds);
  const channelHandles =
    parameters.discoveryMode === "niche_search"
      ? []
      : asStringArray(parameters.channelHandles);
  const targetCreators = creatorIds.length > 0 || channelHandles.length > 0;
  const forceFullDiscovery = parameters.force_full_discovery === true;
  const activePlatforms = scan.platforms.filter(isBudgetedDiscoveryPlatform);

  if (activePlatforms.length === 0) {
    throw new Error(
      "YouTube discovery is disabled. Select Instagram and/or TikTok for this scan.",
    );
  }

  const searchProviders = getConfiguredDiscoveryProviders().filter(
    (p) =>
      p.capabilities().searchPosts &&
      p
        .capabilities()
        .platforms.some(
          (plat) =>
            isBudgetedDiscoveryPlatform(plat) &&
            activePlatforms.includes(plat),
        ),
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
  const { data: usageRows } = await params.supabase
    .from("provider_usage_events")
    .select("provider, metadata, created_at")
    .eq("user_id", params.userId)
    .in("provider", [...BUDGETED_DISCOVERY_PROVIDERS])
    .in("operation", [...DISCOVERY_BUDGET_OPERATIONS])
    .gte("created_at", monthStart.toISOString())
    .limit(Math.max(1000, budgets.monthlyCalls * 2));
  const usageByPlatform = countDiscoveryUsageByPlatform({
    events: usageRows ?? [],
    dayStartIso: dayStart.toISOString(),
  });
  const remainingByPlatform = remainingDiscoveryCallsByPlatform({
    usage: usageByPlatform,
    budgets,
  });
  const platformBudgetErrors = activePlatforms.flatMap((platform) => {
    const status = providerBudgetAllows({
      ...usageByPlatform[platform],
      budgets: getDiscoveryBudgetsForPlatform(platform, budgets),
    });
    return status.ok ? [] : [`${platform}: ${status.message}`];
  });
  if (
    !targetCreators &&
    platformBudgetErrors.length === activePlatforms.length
  ) {
    throw new Error(platformBudgetErrors.join(" · "));
  }

  try {
    resetScrapeCreatorsUsage();
    const retrievedAt = new Date().toISOString();
    const maxResults = Math.min(scan.max_results, budgets.maxResultsPerQuery);
    const lookbackDays = targetCreators
      ? scan.lookback_days
      : forceFullDiscovery
        ? scan.lookback_days
        : incrementalLookbackDays(scan.last_run_at, scan.lookback_days);
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
            !isBudgetedDiscoveryPlatform(target.platform) ||
            !activePlatforms.includes(target.platform)
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
      const reservedBudget = { ...remainingByPlatform };
      const requestedCreatorLimit = Math.min(
        100,
        Math.max(1, params.maxCreatorTargets ?? 10),
      );
      const fairTargets = interleaveCreatorTargets(
        allUniqueTargets,
        activePlatforms,
      );
      const uniqueTargets = fairTargets
        .filter((target) => {
          const provider = getProviderForPlatform(target.platform);
          if (!provider || !isDiscoveryProviderBudgeted(provider.providerName)) {
            return true;
          }
          if (!isBudgetedDiscoveryPlatform(target.platform)) return false;
          if (reservedBudget[target.platform] <= 0) return false;
          reservedBudget[target.platform] -= 1;
          return true;
        })
        .slice(0, requestedCreatorLimit);

      if (uniqueTargets.length === 0) {
        if (platformBudgetErrors.length > 0) {
          throw new Error(platformBudgetErrors.join(" · "));
        }
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
        const scrapeCreditsBefore =
          getScrapeCreatorsUsage().creditsChargedThisSession;
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
          const scrapeCreditsAfter =
            getScrapeCreatorsUsage().creditsChargedThisSession;
          const usageUnits =
            provider.providerName === "scrapecreators"
              ? Math.max(1, scrapeCreditsAfter - scrapeCreditsBefore)
              : 1;
          usedProviders.add(provider.providerName);
          discovered.push(...posts);
          await params.supabase.from("provider_usage_events").insert(
            Array.from({ length: usageUnits }, (_, index) => ({
              user_id: params.userId,
              provider: provider.providerName,
              operation: "get_creator_posts",
              result_count: index === 0 ? posts.length : 0,
              metadata: {
                scanId: scan.id,
                platform: target.platform,
                platformCreatorId: target.platformCreatorId,
                providerCreditUnit: index + 1,
                providerCreditsCharged: usageUnits,
              },
            })),
          );
          if (posts.length === 0) {
            providerNotes.push(
              `${provider.providerName}: 0 results for ${target.platformCreatorId}`,
            );
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const scrapeCreditsAfter =
            getScrapeCreatorsUsage().creditsChargedThisSession;
          const usageUnits =
            provider.providerName === "scrapecreators"
              ? Math.max(1, scrapeCreditsAfter - scrapeCreditsBefore)
              : 1;
          await params.supabase.from("provider_usage_events").insert(
            Array.from({ length: usageUnits }, (_, index) => ({
              user_id: params.userId,
              provider: provider.providerName,
              operation: "get_creator_posts",
              result_count: 0,
              metadata: {
                scanId: scan.id,
                platform: target.platform,
                platformCreatorId: target.platformCreatorId,
                failed: true,
                providerCreditUnit: index + 1,
                providerCreditsCharged: usageUnits,
              },
            })),
          );
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
      const discoveryQueries = asStringArray(parameters.discoveryQueries);
      const { batch, nextCursor } = nextDiscoveryQueryBatch(
        discoveryQueries.length > 0 ? discoveryQueries : [scan.query],
        Number(parameters.discovery_query_cursor) || 0,
        4,
      );
      parameters.discovery_query_cursor = nextCursor;
      const perQuery = Math.max(8, Math.ceil(maxResults / Math.max(1, batch.length)));
      const preferLatest =
        Boolean(scan.last_run_at) && !forceFullDiscovery && lookbackDays <= 14;

      const searchReservations = { ...remainingByPlatform };
      const searchTasks: Array<
        Promise<{
          provider: (typeof searchProviders)[number];
          posts: SearchPostResult[];
          query: string;
          platform: "instagram" | "tiktok";
          usageUnits: number;
        }>
      > = [];
      for (const provider of searchProviders) {
        const capabilities = provider.capabilities();
        for (const platform of activePlatforms) {
          if (!capabilities.platforms.includes(platform)) continue;
          for (const query of batch) {
            if (isDiscoveryProviderBudgeted(provider.providerName)) {
              const maximumCredits =
                provider.providerName === "scrapecreators"
                  ? platform === "instagram"
                    ? lookbackDays <= 2
                      ? 2
                      : 6
                    : 2
                  : 1;
              if (searchReservations[platform] < maximumCredits) continue;
              searchReservations[platform] -= maximumCredits;
            }
            searchTasks.push(
              (async () => {
                try {
                  const execute = () =>
                    provider.searchPosts({
                      query,
                      platforms: [platform],
                      lookbackDays,
                      maxResults: perQuery,
                      minViews: 0,
                      sortBy: preferLatest ? "latest" : "relevance",
                    });
                  const captured =
                    provider.providerName === "scrapecreators"
                      ? await captureScrapeCreatorsUsage(execute)
                      : { value: await execute(), creditsCharged: 1 };
                  return {
                    provider,
                    posts: captured.value,
                    query,
                    platform,
                    usageUnits: Math.max(1, captured.creditsCharged),
                  };
                } catch (error) {
                  const cause =
                    error instanceof Error ? error : new Error(String(error));
                  Object.assign(cause, {
                    discoveryPlatform: platform,
                    discoveryProvider: provider.providerName,
                  });
                  throw cause;
                }
              })(),
            );
          }
        }
      }

      if (searchTasks.length === 0) {
        throw new Error(
          platformBudgetErrors.length > 0
            ? platformBudgetErrors.join(" · ")
            : "No Instagram or TikTok discovery searches could be scheduled.",
        );
      }

      const settled = await Promise.allSettled(searchTasks);

      for (const result of settled) {
        if (result.status === "fulfilled") {
          const { provider, posts, query, platform, usageUnits } = result.value;
          usedProviders.add(provider.providerName);
          discovered.push(
            ...posts.map((post) => ({ ...post, matchedQuery: query })),
          );
          await params.supabase.from("provider_usage_events").insert(
            Array.from({ length: usageUnits }, (_, index) => ({
              user_id: params.userId,
              provider: provider.providerName,
              operation: "search_posts",
              result_count: index === 0 ? posts.length : 0,
              metadata: {
                scanId: scan.id,
                platform,
                query,
                lookbackDays,
                incremental: Boolean(scan.last_run_at) && !forceFullDiscovery,
                providerCreditUnit: index + 1,
                providerCreditsCharged: usageUnits,
              },
            })),
          );
          if (posts.length === 0) {
            providerNotes.push(
              `${provider.providerName} · ${platform} · ${query}: 0 results`,
            );
          }
        } else {
          const message =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          const capturedUsageUnits = scrapeCreatorsCreditsChargedFromError(
            result.reason,
          );
          const failedPlatform =
            result.reason && typeof result.reason === "object"
              ? String(
                  (result.reason as { discoveryPlatform?: unknown })
                    .discoveryPlatform ?? "",
                )
              : "";
          const failedProvider =
            result.reason && typeof result.reason === "object"
              ? String(
                  (result.reason as { discoveryProvider?: unknown })
                    .discoveryProvider ?? "",
                )
              : "";
          const usageUnits =
            capturedUsageUnits > 0
              ? capturedUsageUnits
              : isDiscoveryProviderBudgeted(failedProvider)
                ? 1
                : 0;
          if (usageUnits > 0) {
            await params.supabase.from("provider_usage_events").insert(
              Array.from({ length: usageUnits }, (_, index) => ({
                user_id: params.userId,
                provider: failedProvider || "scrapecreators",
                operation: "search_posts",
                result_count: 0,
                metadata: {
                  platform: failedPlatform,
                  failed: true,
                  providerCreditUnit: index + 1,
                  providerCreditsCharged: usageUnits,
                },
              })),
            );
          }
          providerErrors.push(message);
          console.error(`[research-scan] provider search failed: ${message}`);
        }
      }

      if (discovered.length === 0 && providerErrors.length > 0) {
        throw new Error(providerErrors.join(" · "));
      }
    }

    const eligiblePosts = keepPostsPostedSince(
      filterRecentShortForm(discovered, {
        lookbackDays,
        strictLookback:
          !targetCreators && Boolean(scan.last_run_at) && !forceFullDiscovery,
      }),
      targetCreators || forceFullDiscovery
        ? null
        : postedSinceCutoff(scan.last_run_at),
    );
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
      keywordSearch: !targetCreators,
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
      lookback_days: lookbackDays,
      incremental: Boolean(scan.last_run_at) && !targetCreators && !forceFullDiscovery,
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
          discoveryMode:
            parameters.discoveryMode === "niche_search"
              ? "niche_search"
              : parameters.discoveryMode,
          force_full_discovery: false,
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
