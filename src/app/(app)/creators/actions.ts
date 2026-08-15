"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CREATOR_CATALOG, parseCatalogCount } from "@/data/creator-catalog";
import { canDiscoverPlatform } from "@/lib/research/discovery/configured";
import { importCreatorCatalog } from "@/lib/research/import-creator-catalog";
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
  return canDiscoverPlatform(platform);
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
        notes: `Imported workbook snapshot: ${catalogEntry.followers} followers/subscribers; ${catalogEntry.views} views. ${trackable ? "Included in rolling 30-day short-form scans." : catalogEntry.platform === "instagram" ? "Instagram pull needs Meta Business Discovery or SCRAPECREATORS_API_KEY." : "Add the matching discovery provider key to enable scheduled pulls."}`,
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

export async function unfollowCreatorFromCatalogAction(formData: FormData): Promise<void> {
  const parsed = followSchema.safeParse({
    username: formData.get("username"),
    platform: formData.get("platform"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("external_creators")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", parsed.data.platform)
    .eq("handle", parsed.data.username);

  revalidatePath("/creators");
  revalidatePath("/research");
}

export async function importCreatorCatalogAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  let result: Awaited<ReturnType<typeof importCreatorCatalog>>;
  try {
    result = await importCreatorCatalog({ supabase, userId: user.id });
  } catch (error) {
    redirect(
      `/creators?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Creator import failed.",
      )}`,
    );
  }
  revalidatePath("/creators");
  revalidatePath("/research");
  redirect(`/creators?imported=${result.imported}&trackable=${result.trackable}`);
}
