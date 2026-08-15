import type { SupabaseClient } from "@supabase/supabase-js";
import type { InstagramAccountInsights } from "@/lib/social/types";

function dayKeyFromIso(value: string): string {
  return value.slice(0, 10);
}

/** Append one sync-time account snapshot + backfill daily rows from Instagram insights. */
export async function persistAccountMetricSnapshots(params: {
  supabase: SupabaseClient;
  userId: string;
  connectionId: string;
  followerCount: number | null;
  insights: InstagramAccountInsights | null;
  capturedAt?: string;
}): Promise<{ written: number }> {
  const capturedAt = params.capturedAt ?? new Date().toISOString();
  const today = dayKeyFromIso(capturedAt);
  let written = 0;

  const syncRow = {
    user_id: params.userId,
    social_connection_id: params.connectionId,
    captured_at: capturedAt,
    day_key: today,
    follower_count: params.followerCount,
    views: params.insights?.totals.views ?? null,
    reach: params.insights?.totals.reach ?? null,
    follows: params.insights?.totals.follows ?? null,
    unfollows: params.insights?.totals.unfollows ?? null,
    source: "sync",
  };

  const { error: syncError } = await params.supabase
    .from("account_metric_snapshots")
    .upsert(syncRow, { onConflict: "social_connection_id,day_key,source" });
  if (!syncError) written += 1;

  if (params.insights?.daily?.length) {
    const dailyRows = params.insights.daily
      .map((day) => {
        const key = day.date?.slice(0, 10);
        if (!key) return null;
        return {
          user_id: params.userId,
          social_connection_id: params.connectionId,
          captured_at: `${key}T12:00:00.000Z`,
          day_key: key,
          follower_count: day.followerCount ?? null,
          views: day.views ?? null,
          reach: day.reach ?? null,
          follows: null,
          unfollows: null,
          source: "instagram_daily",
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    if (dailyRows.length > 0) {
      const { error } = await params.supabase
        .from("account_metric_snapshots")
        .upsert(dailyRows, {
          onConflict: "social_connection_id,day_key,source",
        });
      if (!error) written += dailyRows.length;
    }
  }

  return { written };
}

export async function loadAccountMetricSnapshots(params: {
  supabase: SupabaseClient;
  userId: string;
  connectionIds?: string[];
  sinceDayKey?: string;
}): Promise<
  Array<{
    social_connection_id: string;
    day_key: string;
    follower_count: number | null;
    views: number | null;
    reach: number | null;
    follows: number | null;
    unfollows: number | null;
    source: string;
  }>
> {
  let query = params.supabase
    .from("account_metric_snapshots")
    .select(
      "social_connection_id, day_key, follower_count, views, reach, follows, unfollows, source",
    )
    .eq("user_id", params.userId)
    .order("day_key", { ascending: true });

  if (params.connectionIds?.length) {
    query = query.in("social_connection_id", params.connectionIds);
  }
  if (params.sinceDayKey) {
    query = query.gte("day_key", params.sinceDayKey);
  }

  const { data, error } = await query.limit(2000);
  if (error) return [];
  return (data ?? []) as Array<{
    social_connection_id: string;
    day_key: string;
    follower_count: number | null;
    views: number | null;
    reach: number | null;
    follows: number | null;
    unfollows: number | null;
    source: string;
  }>;
}
