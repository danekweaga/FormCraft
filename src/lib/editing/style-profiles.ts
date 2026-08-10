import type { SupabaseClient } from "@supabase/supabase-js";

export type StyleSourceType =
  | "personal"
  | "reference"
  | "custom"
  | "experiment"
  | "knowledge";

export type EditingStyleProfile = {
  id: string;
  name: string;
  source_type: StyleSourceType;
  description: string | null;
  principles: string[];
  observed_patterns: string[];
  preferred_complexity: string | null;
  user_confirmed: boolean;
};

/**
 * Aggregate sparse "My Style" principles from owned posts when attributes exist.
 * Never invents editing trends.
 */
export async function buildMyStylePrinciples(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<string[]> {
  const { data: posts } = await params.supabase
    .from("content_posts")
    .select("title, caption, classification, platform")
    .eq("user_id", params.userId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(40);

  const principles: string[] = [];
  const captions = (posts ?? [])
    .map((p) => `${p.title ?? ""} ${p.caption ?? ""}`.toLowerCase())
    .join("\n");

  if (!posts?.length) {
    return [
      "Not enough owned posts to infer personal editing style — use Minimal Yap or Custom direction.",
    ];
  }

  principles.push(
    `Based on ${posts.length} recent owned posts (metadata/captions only — not frame-level editing).`,
  );

  const screenShareHints = (captions.match(/\b(screenshot|screen|demo|walkthrough)\b/g) ?? [])
    .length;
  if (screenShareHints >= 3) {
    principles.push(
      "Observable pattern: captions often mention screenshots/demos — proof visuals may fit your style.",
    );
  }

  const memeHints = (captions.match(/\b(meme|lol|joke)\b/g) ?? []).length;
  if (memeHints >= 2) {
    principles.push(
      "Observable pattern: occasional comedic/meme language in captions — optional, not mandatory.",
    );
  }

  const yapLike = posts.filter(
    (p) => (p.platform === "instagram" || p.platform === "tiktok") && !p.classification,
  ).length;
  if (yapLike >= 5) {
    principles.push(
      "Many short-form posts — prefer light editing unless direction says otherwise.",
    );
  }

  if (principles.length === 1) {
    principles.push(
      "Style signal is sparse. Prefer creator-confirmed direction over inferred rules.",
    );
  }

  return principles;
}

export async function upsertStyleProfile(params: {
  supabase: SupabaseClient;
  userId: string;
  name: string;
  sourceType: StyleSourceType;
  description?: string | null;
  principles: string[];
  observedPatterns?: string[];
  preferredComplexity?: string | null;
  userConfirmed?: boolean;
  sourceAnalysisId?: string | null;
  sourceResearchItemId?: string | null;
}): Promise<{ id: string } | { error: string }> {
  const { data, error } = await params.supabase
    .from("editing_style_profiles")
    .insert({
      user_id: params.userId,
      name: params.name.slice(0, 120),
      source_type: params.sourceType,
      description: params.description ?? null,
      principles: params.principles,
      observed_patterns: params.observedPatterns ?? [],
      preferred_complexity: params.preferredComplexity ?? null,
      user_confirmed: params.userConfirmed ?? false,
      source_analysis_id: params.sourceAnalysisId ?? null,
      source_research_item_id: params.sourceResearchItemId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not save profile." };
  return { id: data.id };
}

export async function listStyleProfiles(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<EditingStyleProfile[]> {
  const { data } = await params.supabase
    .from("editing_style_profiles")
    .select(
      "id, name, source_type, description, principles, observed_patterns, preferred_complexity, user_confirmed",
    )
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(30);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    source_type: row.source_type as StyleSourceType,
    description: row.description,
    principles: Array.isArray(row.principles)
      ? (row.principles as string[])
      : [],
    observed_patterns: Array.isArray(row.observed_patterns)
      ? (row.observed_patterns as string[])
      : [],
    preferred_complexity: row.preferred_complexity,
    user_confirmed: row.user_confirmed,
  }));
}
