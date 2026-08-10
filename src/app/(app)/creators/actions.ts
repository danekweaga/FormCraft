"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CREATOR_CATALOG, parseCatalogCount } from "@/data/creator-catalog";
import { resolvePlatformCreatorId } from "@/lib/research/resolve-creator";
import { createClient } from "@/lib/supabase/server";

const followSchema = z.object({
  username: z.string().trim().min(1).max(120),
  platform: z.enum(["instagram", "tiktok", "youtube"]),
});

function creatorProfileUrl(platform: string, username: string): string {
  if (platform === "instagram") return `https://www.instagram.com/${username}/`;
  if (platform === "tiktok") return `https://www.tiktok.com/@${username}`;
  return `https://www.youtube.com/@${username}`;
}

function canPullPlatform(platform: string): boolean {
  if (platform === "youtube") return Boolean(process.env.YOUTUBE_DATA_API_KEY?.trim());
  if (platform === "tiktok") return Boolean(process.env.TIKTOK_DATA_API_KEY?.trim());
  return false;
}

export async function followCreatorFromCatalogAction(formData: FormData): Promise<void> {
  const parsed = followSchema.safeParse({
    username: formData.get("username"),
    platform: formData.get("platform"),
  });
  if (!parsed.success) return;

  const catalogEntry = CREATOR_CATALOG.find(
    (entry) =>
      entry.username === parsed.data.username && entry.platform === parsed.data.platform,
  );
  if (!catalogEntry) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: watchlist } = await supabase
    .from("research_watchlists")
    .upsert(
      {
        user_id: user.id,
        name: "Creators I follow",
        description: "Creator directory imported from the user-supplied workbook.",
        paused: false,
      },
      { onConflict: "user_id,name" },
    )
    .select("id")
    .single();
  if (!watchlist) return;

  const resolvedId = catalogEntry.platform === "youtube"
    ? await resolvePlatformCreatorId({ platform: "youtube", handle: catalogEntry.username })
    : catalogEntry.username;
  const trackable = canPullPlatform(catalogEntry.platform) && Boolean(resolvedId);
  const { data: creator } = await supabase
    .from("external_creators")
    .upsert(
      {
        user_id: user.id,
        platform: catalogEntry.platform,
        platform_creator_id: resolvedId || catalogEntry.username,
        handle: catalogEntry.username,
        display_name: catalogEntry.username,
        profile_url: creatorProfileUrl(catalogEntry.platform, catalogEntry.username),
        follower_count: parseCatalogCount(catalogEntry.followers),
        data_source: "user_import",
        data_freshness_at: null,
        tracking_paused: !trackable,
        notes: `Imported workbook snapshot: ${catalogEntry.followers} followers/subscribers; ${catalogEntry.views} views. ${trackable ? "Included in rolling 30-day short-form scans." : catalogEntry.platform === "instagram" ? "Instagram's official APIs do not allow competitor-feed pulling; save public Reel URLs manually." : "Add the matching discovery provider key to enable scheduled pulls."}`,
      },
      { onConflict: "user_id,platform,platform_creator_id" },
    )
    .select("id")
    .single();
  if (!creator) return;

  await supabase.from("research_watchlist_members").upsert(
    {
      watchlist_id: watchlist.id,
      external_creator_id: creator.id,
      notes: "Added from creator_accounts_list.xlsx",
    },
    { onConflict: "watchlist_id,external_creator_id" },
  );

  revalidatePath("/creators");
  revalidatePath("/research");
}

export async function importCreatorCatalogAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: watchlist, error: watchlistError } = await supabase
    .from("research_watchlists")
    .upsert(
      {
        user_id: user.id,
        name: "Niche creator scan",
        description: "User-supplied channels scanned for recent short-form outliers from the last 30 days.",
        paused: false,
      },
      { onConflict: "user_id,name" },
    )
    .select("id")
    .single();
  if (watchlistError || !watchlist) redirect(`/creators?error=${encodeURIComponent(watchlistError?.message ?? "Could not create watchlist")}`);

  const youtubeEntries = CREATOR_CATALOG.filter((entry) => entry.platform === "youtube");
  const youtubeIds = new Map<string, string | null>(
    await Promise.all(
      youtubeEntries.map(async (entry) => [
        entry.username,
        await resolvePlatformCreatorId({ platform: "youtube", handle: entry.username }),
      ] as const),
    ),
  );

  const rows = CREATOR_CATALOG.map((entry) => {
    const resolvedId = entry.platform === "youtube" ? youtubeIds.get(entry.username) : entry.username;
    const trackable = canPullPlatform(entry.platform) && Boolean(resolvedId);
    return {
      user_id: user.id,
      platform: entry.platform,
      platform_creator_id: resolvedId || entry.username,
      handle: entry.username,
      display_name: entry.username,
      profile_url: creatorProfileUrl(entry.platform, entry.username),
      follower_count: parseCatalogCount(entry.followers),
      data_source: "user_import",
      tracking_paused: !trackable,
      notes: `Workbook snapshot: ${entry.followers} followers/subscribers; ${entry.views} views. ${trackable ? "Rolling 30-day short-form scan enabled." : entry.platform === "instagram" ? "Manual public Reel references only; competitor-feed access is not provided by Instagram's official API." : "Provider access is not configured."}`,
    };
  });

  const { data: creators, error: creatorError } = await supabase
    .from("external_creators")
    .upsert(rows, { onConflict: "user_id,platform,platform_creator_id" })
    .select("id, tracking_paused");
  if (creatorError) redirect(`/creators?error=${encodeURIComponent(creatorError.message)}`);

  const memberships = (creators ?? []).map((creator) => ({
    watchlist_id: watchlist.id,
    external_creator_id: creator.id,
    notes: "Imported from creator_accounts_list.xlsx for the rolling 30-day niche scan.",
  }));
  if (memberships.length) {
    const { error } = await supabase.from("research_watchlist_members").upsert(memberships, { onConflict: "watchlist_id,external_creator_id" });
    if (error) redirect(`/creators?error=${encodeURIComponent(error.message)}`);
  }

  const trackable = (creators ?? []).filter((creator) => !creator.tracking_paused).length;
  revalidatePath("/creators");
  revalidatePath("/research");
  redirect(`/creators?imported=${creators?.length ?? 0}&trackable=${trackable}`);
}
