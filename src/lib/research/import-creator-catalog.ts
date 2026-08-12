import type { SupabaseClient } from "@supabase/supabase-js";
import { CREATOR_CATALOG, parseCatalogCount } from "@/data/creator-catalog";
import { canDiscoverPlatform } from "./discovery/configured";
import { resolvePlatformCreatorId } from "./resolve-creator";

function creatorProfileUrl(platform: string, username: string): string {
  if (platform === "instagram") return `https://www.instagram.com/${username}/`;
  if (platform === "tiktok") return `https://www.tiktok.com/@${username}`;
  return `https://www.youtube.com/@${username}`;
}

function canPullPlatform(platform: string): boolean {
  return canDiscoverPlatform(platform);
}

export async function importCreatorCatalog(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<{ imported: number; trackable: number; watchlistId: string }> {
  const { data: watchlist, error: watchlistError } = await params.supabase
    .from("research_watchlists")
    .upsert(
      {
        user_id: params.userId,
        name: "Niche creator scan",
        description:
          "User-supplied channels scanned for recent short-form outliers from the last 30 days.",
        paused: false,
      },
      { onConflict: "user_id,name" },
    )
    .select("id")
    .single();
  if (watchlistError || !watchlist) {
    throw new Error(
      watchlistError?.message ?? "Could not create the creator watchlist.",
    );
  }

  const youtubeEntries = CREATOR_CATALOG.filter(
    (entry) => entry.platform === "youtube",
  );
  const youtubeIds = new Map<string, string | null>(
    await Promise.all(
      youtubeEntries.map(async (entry) => [
        entry.username,
        await resolvePlatformCreatorId({
          platform: "youtube",
          handle: entry.username,
        }),
      ] as const),
    ),
  );

  const rows = CREATOR_CATALOG.map((entry) => {
    const resolvedId =
      entry.platform === "youtube"
        ? youtubeIds.get(entry.username)
        : entry.username;
    const trackable = canPullPlatform(entry.platform) && Boolean(resolvedId);
    return {
      user_id: params.userId,
      platform: entry.platform,
      platform_creator_id: resolvedId || entry.username,
      handle: entry.username,
      display_name: entry.username,
      profile_url: creatorProfileUrl(entry.platform, entry.username),
      follower_count: parseCatalogCount(entry.followers),
      data_source: "user_import",
      tracking_paused: !trackable,
      notes: `Workbook snapshot: ${entry.followers} followers/subscribers; ${entry.views} views. ${
        trackable
          ? "Rolling 30-day short-form scan enabled."
          : entry.platform === "instagram"
            ? "Instagram pull needs Meta Business Discovery or SCRAPECREATORS_API_KEY."
            : "Provider access is not configured."
      }`,
    };
  });

  const { data: creators, error: creatorError } = await params.supabase
    .from("external_creators")
    .upsert(rows, { onConflict: "user_id,platform,platform_creator_id" })
    .select("id, tracking_paused");
  if (creatorError) throw new Error(creatorError.message);

  const memberships = (creators ?? []).map((creator) => ({
    watchlist_id: watchlist.id,
    external_creator_id: creator.id,
    notes:
      "Imported from creator_accounts_list.xlsx for the rolling 30-day niche scan.",
  }));
  if (memberships.length) {
    const { error } = await params.supabase
      .from("research_watchlist_members")
      .upsert(memberships, {
        onConflict: "watchlist_id,external_creator_id",
      });
    if (error) throw new Error(error.message);
  }

  return {
    imported: creators?.length ?? 0,
    trackable: (creators ?? []).filter((creator) => !creator.tracking_paused)
      .length,
    watchlistId: watchlist.id,
  };
}
