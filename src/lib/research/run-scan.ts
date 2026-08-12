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
  getDiscoveryBudgets,
  providerBudgetAllows,
} from "./provider-budget";
import {
  inferPlatformFromHandle,
  resolvePlatformCreatorId,
} from "./resolve-creator";
import { filterRecentShortForm } from "./recent-short-form";

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
}): Promise<{
  discovered: number;
  eligible: number;
  retained: number;
  providers: string[];
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
      "No configured discovery provider supports the selected platforms. Set SCRAPECREATORS_API_KEY (TikTok + Instagram), YOUTUBE_DATA_API_KEY, and/or TIKTOK_DATA_API_KEY, or enable RESEARCH_ENABLE_DEMO.",
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
    resetScrapeCreatorsUsage();
    const retrievedAt = new Date().toISOString();
    const maxResults = Math.min(scan.max_results, budgets.maxResultsPerQuery);
    const usedProviders = new Set<string>();
    const discovered: SearchPostResult[] = [];
    const providerErrors: string[] = [];

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
      }> = (tracked ?? []).map((c) => ({
        platform: c.platform,
        platformCreatorId: c.platform_creator_id,
      }));

      for (const handle of channelHandles) {
        const platform = inferPlatformFromHandle(handle, scan.platforms);
        if (!platform) continue;
        const platformCreatorId = await resolvePlatformCreatorId({
          platform,
          handle,
        });
        if (!platformCreatorId) continue;
        targets.push({ platform, platformCreatorId });

        await params.supabase.from("external_creators").upsert(
          {
            user_id: params.userId,
            platform,
            platform_creator_id: platformCreatorId,
            handle: handle.replace(/^@/, ""),
            display_name: handle.replace(/^@/, ""),
            data_source:
              platform === "youtube" ? "official_api" : "third_party_api",
            data_freshness_at: retrievedAt,
          },
          { onConflict: "user_id,platform,platform_creator_id" },
        );
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
      // one provider request. Pull the oldest ten selected creators per run;
      // subsequent runs continue with the next stale batch.
      const remainingBudget = Math.min(
        Math.max(0, budgets.dailyCalls - (callsToday ?? 0)),
        Math.max(0, budgets.monthlyCalls - (callsMonth ?? 0)),
      );
      const uniqueTargets = allUniqueTargets.slice(
        0,
        Math.min(10, remainingBudget),
      );

      if (uniqueTargets.length === 0) {
        throw new Error(
          "No supported YouTube or TikTok creators were selected for this pull.",
        );
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
              platformCreatorId: target.platformCreatorId,
            },
          });
          if (posts.length === 0) {
            providerErrors.push(
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
        }
      }

      if (allUniqueTargets.length > uniqueTargets.length) {
        providerErrors.push(
          `Pulled ${uniqueTargets.length} of ${allUniqueTargets.length} selected creators in this safe batch; run the pull again for the next oldest channels`,
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
            providerErrors.push(`${provider.providerName}: 0 results`);
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
    });

    const now = new Date();
    const nextRun = new Date(now.getTime() + 86_400_000);
    const byPlatform = discovered.reduce<Record<string, number>>((acc, post) => {
      acc[post.platform] = (acc[post.platform] ?? 0) + 1;
      return acc;
    }, {});
    const scUsage = getScrapeCreatorsUsage();
    const creditWarning = scrapeCreatorsCreditWarning(
      scUsage.creditsRemaining,
      scUsage.exhausted,
    );
    const lastRunStats = {
      discovered: discovered.length,
      eligible: eligiblePosts.length,
      retained: ingested.retained,
      providers: [...usedProviders],
      by_platform: byPlatform,
      provider_errors: providerErrors,
      at: now.toISOString(),
      scrapecreators: {
        credits_remaining: scUsage.creditsRemaining,
        credits_charged: scUsage.creditsChargedThisSession,
        exhausted: scUsage.exhausted,
      },
    };
    const softError = [creditWarning, ...providerErrors]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 500) || null;
    await params.supabase
      .from("research_scans")
      .update({
        status: "active",
        last_run_at: now.toISOString(),
        next_run_at: nextRun.toISOString(),
        // Keep partial provider failures visible without failing the whole scan.
        last_error: softError,
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
