import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisResult } from "./schema";

type PostMetricRow = {
  id: string;
  platform: string;
  format: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  followers_gained: number | null;
};

type PersonalComparison = NonNullable<AnalysisResult["personalComparison"]>;

const METRICS = [
  "views",
  "reach",
  "likes",
  "comments",
  "shares",
  "saves",
  "followers_gained",
] as const;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function evidenceConfidence(
  sampleSize: number,
): PersonalComparison["confidence"] {
  if (sampleSize <= 2) return "descriptive_only";
  if (sampleSize <= 4) return "very_limited";
  if (sampleSize <= 9) return "low";
  if (sampleSize <= 19) return "medium";
  return "high";
}

function hasMetric(row: PostMetricRow): boolean {
  return METRICS.some((metric) => row[metric] != null);
}

function ageInDays(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(value).getTime()) / 86_400_000;
}

function durationSimilar(left: number | null, right: number | null): boolean {
  if (left == null || right == null) return false;
  return Math.abs(left - right) <= Math.max(10, left * 0.35);
}

export async function buildPersonalComparison(params: {
  supabase: SupabaseClient;
  userId: string;
  contentPostId?: string | null;
}): Promise<PersonalComparison | null> {
  if (!params.contentPostId) return null;

  const { data: currentRaw } = await params.supabase
    .from("content_posts")
    .select(
      "id, platform, format, duration_seconds, published_at, views, reach, likes, comments, shares, saves, followers_gained",
    )
    .eq("id", params.contentPostId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (!currentRaw) return null;

  const current = currentRaw as PostMetricRow;
  const { data: historyRaw } = await params.supabase
    .from("content_posts")
    .select(
      "id, platform, format, duration_seconds, published_at, views, reach, likes, comments, shares, saves, followers_gained",
    )
    .eq("user_id", params.userId)
    .neq("id", current.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(100);

  const history = ((historyRaw ?? []) as PostMetricRow[]).filter(hasMetric);
  const exact = history.filter(
    (post) =>
      post.platform === current.platform &&
      Boolean(current.format) &&
      post.format === current.format &&
      ageInDays(post.published_at) <= 90,
  );
  const durationBand = history.filter(
    (post) =>
      post.platform === current.platform &&
      durationSimilar(current.duration_seconds, post.duration_seconds) &&
      ageInDays(post.published_at) <= 90,
  );
  const samePlatform = history
    .filter((post) => post.platform === current.platform)
    .slice(0, 20);
  const allRecent = history.slice(0, 20);

  let comparable = exact;
  let comparableRule = "same platform + same format + last 90 days";
  if (comparable.length < 3) {
    comparable = durationBand;
    comparableRule = "same platform + similar duration + last 90 days";
  }
  if (comparable.length < 3) {
    comparable = samePlatform;
    comparableRule = "same platform + last 20 posts";
  }
  if (comparable.length < 3) {
    comparable = allRecent;
    comparableRule = "last 20 owned posts";
  }

  const metrics = METRICS.map((metric) => {
    const baseline = median(
      comparable
        .map((post) => post[metric])
        .filter((value): value is number => value != null),
    );
    const value = current[metric];
    return {
      metric,
      current: value,
      median: baseline,
      ratio:
        value != null && baseline != null && baseline > 0
          ? value / baseline
          : null,
    };
  });

  const winners = [...comparable]
    .filter((post) => post.views != null)
    .sort((left, right) => (right.views ?? 0) - (left.views ?? 0))
    .slice(0, 5)
    .map((post) => post.id);
  const confidence = evidenceConfidence(comparable.length);

  return {
    sampleSize: comparable.length,
    confidence,
    comparableRule,
    metrics,
    winnerPostIds: winners,
    note:
      confidence === "descriptive_only"
        ? "Describe these posts individually; the sample is too small for a pattern."
        : confidence === "very_limited"
          ? "Possible pattern, but evidence is very limited."
          : `${confidence} confidence personal comparison; this remains associative, not causal.`,
  };
}

