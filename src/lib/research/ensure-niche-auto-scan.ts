import type { SupabaseClient } from "@supabase/supabase-js";
import { searchablePlatforms } from "./discovery/registry";
import { defaultDiscoveryPlatforms } from "./search-filters";
import type { ResearchPlatform } from "./types";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

function samePlatforms(left: unknown, right: string[]): boolean {
  if (!Array.isArray(left) || left.length !== right.length) return false;
  return left.every((value, index) => String(value) === right[index]);
}

function isNicheSearchScan(parameters: Record<string, unknown>): boolean {
  const creatorIds = asStringArray(parameters.creatorIds);
  return parameters.discoveryMode === "niche_search" && creatorIds.length === 0;
}

/**
 * Ensure an auto-enabled research scan exists from the user's niche profile.
 * Keyword search discovers new creators; watchlists stay on their own monitor
 * so For You is not limited to people already on Creator+.
 */
export async function ensureNicheAutoScan(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<{ scanId: string; created: boolean } | null> {
  const { data: profile } = await params.supabase
    .from("niche_profiles")
    .select("main_niche, keywords, topics, platforms")
    .eq("user_id", params.userId)
    .maybeSingle();

  const queryParts = [
    profile?.main_niche,
    ...(profile?.keywords ?? []).slice(0, 5),
  ].filter((value): value is string => Boolean(value?.trim()));
  const query = queryParts.join(" ").trim();
  if (query.length < 2) return null;

  const configured = searchablePlatforms().map(
    (p) => p.platform as ResearchPlatform,
  );
  const profilePlatforms =
    Array.isArray(profile?.platforms) && profile.platforms.length > 0
      ? (profile.platforms as string[]).filter((p) =>
          configured.includes(p as ResearchPlatform),
        )
      : [];
  const fallback = defaultDiscoveryPlatforms(configured);
  let platforms =
    profilePlatforms.length > 0
      ? profilePlatforms
      : fallback.length > 0
        ? fallback
        : configured;
  // Older niche profiles opted YouTube-only; still pull live sources when keyed.
  if (configured.includes("tiktok") && !platforms.includes("tiktok")) {
    platforms = [...platforms, "tiktok"];
  }
  if (configured.includes("instagram") && !platforms.includes("instagram")) {
    platforms = [...platforms, "instagram"];
  }

  if (platforms.length === 0) return null;

  const name = `Auto: ${(profile?.main_niche || query).slice(0, 60)}`;

  const { data: existing } = await params.supabase
    .from("research_scans")
    .select("id, query, platforms, parameters")
    .eq("user_id", params.userId)
    .eq("auto_scan_enabled", true)
    .ilike("name", "Auto:%")
    .limit(1)
    .maybeSingle();

  const existingParameters =
    existing?.parameters && typeof existing.parameters === "object"
      ? { ...(existing.parameters as Record<string, unknown>) }
      : {};
  const alreadyNicheSearch = isNicheSearchScan(existingParameters);
  delete existingParameters.creatorIds;
  delete existingParameters.channelHandles;

  if (
    existing?.id &&
    existing.query === query &&
    samePlatforms(existing.platforms, platforms) &&
    alreadyNicheSearch
  ) {
    return { scanId: existing.id, created: false };
  }

  const payload = {
    user_id: params.userId,
    name,
    query,
    platforms,
    lookback_days: 30,
    min_views: 0,
    min_outlier_score: 0,
    max_results: 50,
    auto_scan_enabled: true,
    status: "active",
    parameters: {
      ...existingParameters,
      discoveryMode: "niche_search",
    },
  };

  if (existing?.id) {
    await params.supabase
      .from("research_scans")
      .update(payload)
      .eq("id", existing.id)
      .eq("user_id", params.userId);
    return { scanId: existing.id, created: false };
  }

  const { data: created, error } = await params.supabase
    .from("research_scans")
    .insert({
      ...payload,
      next_run_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !created) return null;
  return { scanId: created.id, created: true };
}
