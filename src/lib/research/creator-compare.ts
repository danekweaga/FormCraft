import type { SupabaseClient } from "@supabase/supabase-js";
import {
  baselineConfidence,
  outlierLabel,
  outlierLabelDisplay,
} from "./outliers";

export type CreatorCompareRow = {
  id: string;
  displayName: string;
  platform: string;
  followerCount: number | null;
  postCount: number;
  medianViews: number | null;
  baselineConfidence: "low" | "medium" | "high";
  strongestOutlier: number | null;
  outlierLabel: string | null;
  topics: string[];
  hooks: string[];
  formats: string[];
  postsPerWeek: number | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function formatBucket(seconds: number | null): string {
  if (seconds == null) return "unknown";
  if (seconds <= 90) return "short";
  if (seconds <= 600) return "mid_form";
  return "long_form";
}

export async function compareCreators(params: {
  supabase: SupabaseClient;
  userId: string;
  creatorIds: string[];
}): Promise<CreatorCompareRow[]> {
  const ids = params.creatorIds.slice(0, 5);
  if (ids.length < 2) return [];

  const [{ data: creators }, { data: posts }] = await Promise.all([
    params.supabase
      .from("external_creators")
      .select("id, platform, display_name, handle, follower_count")
      .eq("user_id", params.userId)
      .in("id", ids),
    params.supabase
      .from("research_items")
      .select(
        "external_creator_id, title, hook_text, topic, views, outlier_score, duration_seconds, published_at",
      )
      .eq("user_id", params.userId)
      .in("external_creator_id", ids)
      .eq("hidden", false),
  ]);

  return (creators ?? []).map((creator) => {
    const creatorPosts = (posts ?? []).filter(
      (p) => p.external_creator_id === creator.id,
    );
    const views = creatorPosts
      .map((p) => p.views)
      .filter((v): v is number => typeof v === "number");
    const med = median(views);
    const strongest = creatorPosts.reduce<number | null>((best, post) => {
      const score = post.outlier_score;
      if (typeof score !== "number") return best;
      return best == null || score > best ? score : best;
    }, null);

    const published = creatorPosts
      .map((p) => (p.published_at ? new Date(p.published_at).getTime() : null))
      .filter((t): t is number => t != null && Number.isFinite(t))
      .sort((a, b) => a - b);
    let postsPerWeek: number | null = null;
    if (published.length >= 2) {
      const spanDays =
        (published[published.length - 1]! - published[0]!) / 86_400_000;
      postsPerWeek =
        spanDays > 0 ? (published.length / spanDays) * 7 : published.length;
    }

    const topics = Array.from(
      new Set(
        creatorPosts
          .map((p) => p.topic)
          .filter((t): t is string => Boolean(t)),
      ),
    ).slice(0, 5);
    const hooks = Array.from(
      new Set(
        creatorPosts
          .map((p) => p.hook_text || p.title)
          .filter((t): t is string => Boolean(t)),
      ),
    ).slice(0, 4);
    const formats = Array.from(
      new Set(creatorPosts.map((p) => formatBucket(p.duration_seconds))),
    );

    return {
      id: creator.id,
      displayName: creator.display_name || creator.handle || "Creator",
      platform: creator.platform,
      followerCount: creator.follower_count,
      postCount: creatorPosts.length,
      medianViews: med,
      baselineConfidence: baselineConfidence(views.length),
      strongestOutlier: strongest,
      outlierLabel: outlierLabelDisplay(outlierLabel(strongest)),
      topics,
      hooks,
      formats,
      postsPerWeek,
    };
  });
}
