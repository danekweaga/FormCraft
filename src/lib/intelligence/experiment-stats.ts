import type { SupabaseClient } from "@supabase/supabase-js";
import { personalOutlierMultiplier } from "@/lib/social/baselines";
import { computeBaselines } from "@/lib/my-content/baseline";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import { SAMPLE_GUARDS } from "./sample-guards";

export type ExperimentAggregate = {
  postCount: number;
  medianViews: number | null;
  medianRelativeViews: number | null;
  medianShares: number | null;
  medianSaves: number | null;
  medianComments: number | null;
  evidenceLimited: boolean;
  recommendation: string;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export async function computeExperimentAggregate(params: {
  supabase: SupabaseClient;
  userId: string;
  postIds: string[];
}): Promise<ExperimentAggregate> {
  if (params.postIds.length === 0) {
    return {
      postCount: 0,
      medianViews: null,
      medianRelativeViews: null,
      medianShares: null,
      medianSaves: null,
      medianComments: null,
      evidenceLimited: true,
      recommendation: "Attach posts to begin collecting experiment evidence.",
    };
  }

  const { data: posts } = await params.supabase
    .from("content_posts")
    .select(
      "id, views, likes, comments, shares, saves, followers_gained, platform, source, source_label, title, caption, published_at, is_winner, needs_review, relative_performance, created_at",
    )
    .eq("user_id", params.userId)
    .in("id", params.postIds);

  const typed = (posts ?? []) as ContentPostRow[];
  const allBaselines = computeBaselines(typed);

  const relative = typed
    .map((p) => personalOutlierMultiplier(p.views, allBaselines.views ?? null))
    .filter((v): v is number => v !== null);

  const evidenceLimited =
    typed.length < SAMPLE_GUARDS.experimentPostsPerVariant;

  return {
    postCount: typed.length,
    medianViews: median(typed.map((p) => p.views).filter((v): v is number => v !== null)),
    medianRelativeViews: median(relative),
    medianShares: median(typed.map((p) => p.shares).filter((v): v is number => v !== null)),
    medianSaves: median(typed.map((p) => p.saves).filter((v): v is number => v !== null)),
    medianComments: median(
      typed.map((p) => p.comments).filter((v): v is number => v !== null),
    ),
    evidenceLimited,
    recommendation: evidenceLimited
      ? `Evidence remains limited. Add at least ${SAMPLE_GUARDS.experimentPostsPerVariant} posts before concluding.`
      : "Sample is approaching a usable comparison size. Review medians before declaring a winner.",
  };
}
