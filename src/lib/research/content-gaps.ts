import type { SupabaseClient } from "@supabase/supabase-js";
import { generateNicheBrief } from "./niche-brief";

export type ContentGapReport = {
  topic: string;
  potentialGaps: string[];
  oversaturatedAngles: string[];
  audienceSignals: string[];
  myTopics: string[];
  supportingItemIds: string[];
  usedLlm: boolean;
  disclaimer: string;
};

export async function buildContentGapReport(params: {
  supabase: SupabaseClient;
  userId: string;
  topic?: string;
}): Promise<ContentGapReport> {
  const [{ data: profile }, { data: insights }, { data: posts }, { data: items }] =
    await Promise.all([
      params.supabase
        .from("niche_profiles")
        .select("main_niche, topics, keywords")
        .eq("user_id", params.userId)
        .maybeSingle(),
      params.supabase
        .from("audience_insights")
        .select("summary")
        .eq("user_id", params.userId)
        .eq("status", "active")
        .limit(8),
      params.supabase
        .from("content_posts")
        .select("title, caption, classification, topic")
        .eq("user_id", params.userId)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(30),
      params.supabase
        .from("research_items")
        .select("id, title, topic, outlier_score")
        .eq("user_id", params.userId)
        .eq("hidden", false)
        .order("outlier_score", { ascending: false, nullsFirst: false })
        .limit(40),
    ]);

  const topic =
    params.topic?.trim() ||
    profile?.main_niche ||
    profile?.topics?.[0] ||
    "my niche";

  const myTopics = Array.from(
    new Set(
      (posts ?? [])
        .map((p) => {
          const c = p.classification as Record<string, unknown> | null;
          return (
            p.topic ||
            (typeof c?.topic === "string" ? c.topic : null) ||
            p.title ||
            null
          );
        })
        .filter((t): t is string => Boolean(t)),
    ),
  ).slice(0, 12);

  const brief = await generateNicheBrief({
    supabase: params.supabase,
    userId: params.userId,
    topic,
    lookbackDays: 30,
  });

  const externalTopics = Array.from(
    new Set(
      (items ?? [])
        .map((i) => i.topic || i.title)
        .filter((t): t is string => Boolean(t)),
    ),
  );

  const uncovered = externalTopics.filter(
    (ext) =>
      !myTopics.some(
        (mine) =>
          mine.toLowerCase().includes(ext.toLowerCase().slice(0, 18)) ||
          ext.toLowerCase().includes(mine.toLowerCase().slice(0, 18)),
      ),
  );

  const potentialGaps = Array.from(
    new Set([
      ...(brief.brief.potentialGaps ?? []),
      ...uncovered.slice(0, 5).map(
        (t) =>
          `Potential gap: external research covers “${t}” but your recent My Content does not.`,
      ),
    ]),
  ).slice(0, 8);

  return {
    topic,
    potentialGaps,
    oversaturatedAngles: brief.brief.oversaturatedAngles ?? [],
    audienceSignals: (insights ?? []).map((i) => i.summary).slice(0, 6),
    myTopics,
    supportingItemIds: (items ?? []).slice(0, 8).map((i) => i.id),
    usedLlm: brief.usedLlm,
    disclaimer:
      "These are potential gaps from your current dataset — not proof of market opportunity.",
  };
}
