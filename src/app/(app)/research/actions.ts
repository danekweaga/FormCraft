"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { analyzeResearchBatch } from "@/lib/research/analyze";
import { searchablePlatforms } from "@/lib/research/discovery/registry";
import { runResearchScan } from "@/lib/research/run-scan";
import { normalizeSearchFilters } from "@/lib/research/search-filters";
import type { ResearchPlatform, ScoredResearchVideo } from "@/lib/research/types";
import { createClient } from "@/lib/supabase/server";

export type ResearchActionState = {
  error?: string;
  success?: string;
};

function positiveInteger(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export async function runResearchScanAction(
  _previous: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const allowed = searchablePlatforms().map(
    (p) => p.platform as ResearchPlatform,
  );
  const filters = normalizeSearchFilters({
    query: formData.get("query"),
    platforms: formData.getAll("platforms").length
      ? formData.getAll("platforms")
      : ["youtube"],
    lookbackDays: formData.get("lookbackDays"),
    minViews: formData.get("minViews"),
    minOutlierScore: formData.get("minOutlierScore"),
    maxResults: formData.get("maxResults") ?? 25,
    allowedPlatforms: allowed.length ? allowed : ["youtube"],
  });

  if (filters.query.length < 2 || filters.query.length > 160) {
    return { error: "Enter a niche query between 2 and 160 characters." };
  }

  const { data: existing } = await supabase
    .from("research_scans")
    .select("id")
    .eq("user_id", user.id)
    .eq("query", filters.query)
    .limit(1)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    name: `${filters.query} radar`,
    query: filters.query,
    platforms: filters.platforms,
    lookback_days: filters.lookbackDays,
    min_views: filters.minViews,
    min_outlier_score: filters.minOutlierScore,
    max_results: filters.maxResults,
    auto_scan_enabled: true,
    status: "active",
  };

  const write = existing
    ? await supabase
        .from("research_scans")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", user.id)
        .select("id")
        .single()
    : await supabase.from("research_scans").insert(payload).select("id").single();

  if (write.error || !write.data) {
    return { error: write.error?.message ?? "Could not save the scan." };
  }

  try {
    const result = await runResearchScan({
      supabase,
      userId: user.id,
      scanId: write.data.id,
    });
    revalidatePath("/research");
    return {
      success: `Scanned ${result.discovered} posts via ${result.providers.join(", ")} and kept ${result.retained} outliers. Deep AI analysis runs only when you click Analyze.`,
    };
  } catch (error) {
    revalidatePath("/research");
    return {
      error: error instanceof Error ? error.message : "Research scan failed.",
    };
  }
}

function identifyReference(rawUrl: string): {
  platform: ResearchPlatform;
  externalId: string;
  normalizedUrl: string;
} {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("Use a public https URL.");
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).at(-1);
    if (!id) throw new Error("Could not find the YouTube video ID.");
    return { platform: "youtube", externalId: id, normalizedUrl: url.toString() };
  }
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (!id) throw new Error("Could not find the YouTube video ID.");
    return { platform: "youtube", externalId: id, normalizedUrl: url.toString() };
  }
  if (host === "instagram.com") {
    const match = url.pathname.match(/^\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (!match) throw new Error("Use a direct Instagram post or Reel URL.");
    return { platform: "instagram", externalId: match[1]!, normalizedUrl: url.toString() };
  }
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    const match = url.pathname.match(/\/video\/(\d+)/);
    const id = match?.[1] ?? createHash("sha256").update(url.toString()).digest("hex");
    return { platform: "tiktok", externalId: id, normalizedUrl: url.toString() };
  }

  return {
    platform: "other",
    externalId: createHash("sha256").update(url.toString()).digest("hex"),
    normalizedUrl: url.toString(),
  };
}

export async function saveResearchReferenceAction(
  _previous: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const rawUrl = String(formData.get("url") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim().slice(0, 300);
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 5000);
  let reference: ReturnType<typeof identifyReference>;
  try {
    reference = identifyReference(rawUrl);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid URL." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const video: ScoredResearchVideo = {
    platform: reference.platform,
    externalId: reference.externalId,
    externalUrl: reference.normalizedUrl,
    creatorId: null,
    creatorName: null,
    title: title || null,
    description: notes || null,
    thumbnailUrl: null,
    publishedAt: null,
    durationSeconds: null,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    baselineViews: null,
    outlierScore: null,
    scoreBasis: "unavailable",
  };
  const analyzed = await analyzeResearchBatch({
    supabase,
    userId: user.id,
    query: title || "manual reference",
    videos: [video],
  });
  const result = analyzed.get(video.externalId);

  const { error } = await supabase.from("research_items").upsert(
    {
      user_id: user.id,
      platform: reference.platform,
      external_id: reference.externalId,
      external_url: reference.normalizedUrl,
      title: title || null,
      description: notes || null,
      hook_text: result?.analysis.hookText ?? title ?? null,
      topic: result?.analysis.topic ?? null,
      analysis: result?.analysis ?? {},
      analysis_model: result?.model ?? null,
      saved: true,
      source: "manual_reference",
    },
    { onConflict: "user_id,platform,external_id" },
  );
  if (error) return { error: error.message };

  revalidatePath("/research");
  return {
    success:
      reference.platform === "youtube"
        ? "YouTube reference saved and analyzed from the metadata you supplied."
        : `${reference.platform} reference saved. Analysis uses only the title/notes you supplied.`,
  };
}

export async function toggleResearchSavedAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nextSaved = String(formData.get("nextSaved") ?? "false") === "true";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !id) return;
  await supabase
    .from("research_items")
    .update({ saved: nextSaved })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/research");
}

export async function analyzeResearchItemAction(
  formData: FormData,
): Promise<ResearchActionState> {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: item } = await supabase
    .from("research_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!item) return { error: "Item not found." };

  const video: ScoredResearchVideo = {
    platform: item.platform as ResearchPlatform,
    externalId: item.external_id,
    externalUrl: item.external_url,
    creatorId: item.creator_id,
    creatorName: item.creator_name,
    title: item.title,
    description: item.description,
    thumbnailUrl: item.thumbnail_url,
    publishedAt: item.published_at,
    durationSeconds: item.duration_seconds,
    views: item.views,
    likes: item.likes,
    comments: item.comments,
    shares: item.shares,
    baselineViews: item.baseline_views,
    outlierScore: item.outlier_score,
    scoreBasis: (item.score_basis as ScoredResearchVideo["scoreBasis"]) ?? "unavailable",
  };

  const analyzed = await analyzeResearchBatch({
    supabase,
    userId: user.id,
    query: item.topic || "outlier analysis",
    videos: [video],
  });
  const result = analyzed.get(video.externalId);
  if (!result) {
    return {
      error:
        "AI analysis unavailable. Your metrics are safe — retry or continue without AI.",
    };
  }

  await supabase
    .from("research_items")
    .update({
      analysis: result.analysis,
      analysis_model: result.model,
      hook_text: result.analysis.hookText ?? item.hook_text,
      topic: result.analysis.topic ?? item.topic,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/research");
  return { success: "Deep analysis complete (metadata-only evidence)." };
}

export async function createWatchlistAction(
  _prev: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Watchlist name is required." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("research_watchlists").insert({
    user_id: user.id,
    name: name.slice(0, 80),
    description: String(formData.get("description") ?? "").trim().slice(0, 500) || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/research");
  return { success: `Watchlist “${name}” created.` };
}

export async function trackCreatorFromItemAction(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const watchlistId = String(formData.get("watchlistId") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: item } = await supabase
    .from("research_items")
    .select("external_creator_id, creator_id, creator_name, platform")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!item?.external_creator_id && !item?.creator_id) return;

  let creatorId = item.external_creator_id as string | null;
  if (!creatorId && item.creator_id) {
    const { data: created } = await supabase
      .from("external_creators")
      .upsert(
        {
          user_id: user.id,
          platform: item.platform,
          platform_creator_id: item.creator_id,
          display_name: item.creator_name,
          handle: item.creator_name,
          data_source: "official_api",
          data_freshness_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,platform_creator_id" },
      )
      .select("id")
      .single();
    creatorId = created?.id ?? null;
  }
  if (!creatorId) return;

  if (watchlistId) {
    await supabase.from("research_watchlist_members").upsert(
      {
        watchlist_id: watchlistId,
        external_creator_id: creatorId,
        priority: 0,
      },
      { onConflict: "watchlist_id,external_creator_id" },
    );
  }

  revalidatePath("/research");
  revalidatePath(`/research/creators/${creatorId}`);
}

export async function generateIdeasFromResearchAction(
  formData: FormData,
): Promise<ResearchActionState> {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  try {
    const { generateIdeasFromOutlier } = await import(
      "@/lib/research/generate-ideas"
    );
    const { evaluateIdeaWithContext, toDbRecommendation } = await import(
      "@/lib/growth/idea-gate-intelligence"
    );
    const { buildFormCraftContext } = await import(
      "@/lib/ai/context/formcraft-context"
    );

    const { ideas } = await generateIdeasFromOutlier({
      supabase,
      userId: user.id,
      researchItemId: id,
    });
    const idea = ideas[0];
    if (!idea) return { error: "No idea generated." };

    const context = await buildFormCraftContext(supabase, {
      userId: user.id,
      taskType: "idea_evaluation",
      query: `${idea.title} ${idea.hook}`,
    });
    const decision = await evaluateIdeaWithContext({
      idea: `${idea.title}\n\n${idea.hook}\n\n${idea.coreClaim}\n\n${idea.uniqueAngle}`,
      context,
      priorTexts: [],
      supabase,
      userId: user.id,
    });

    const { error } = await supabase
      .from("idea_gate_evaluations")
      .insert({
        user_id: user.id,
        idea_text: `${idea.title}\n\nHook: ${idea.hook}\n\n${idea.coreClaim}`,
        recommendation: toDbRecommendation(decision.recommendation),
        why: `${decision.summary}\n\nFrom research outlier → Idea Gate: ${decision.recommendation}`,
        evidence: decision.evidence.map((label) => ({ label })),
        risks: decision.weaknesses.map((label) => ({ label })),
        better_angle: decision.suggestedAngle ?? idea.uniqueAngle,
        best_format: decision.suggestedFormat ?? idea.format,
        status: "evaluated",
        related_ids: {
          researchItemId: id,
          idea,
          decision,
        },
      });

    if (error) return { error: error.message };

    revalidatePath("/research");
    revalidatePath("/idea-gate");
    return {
      success: `Idea generated and sent to Idea Gate (${decision.recommendation}). Open Idea Gate to review.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Idea generation failed.",
    };
  }
}

export async function submitResearchFeedbackAction(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const feedbackType = String(formData.get("feedbackType") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !itemId || !feedbackType) return;

  await supabase.from("research_feedback").insert({
    user_id: user.id,
    research_item_id: itemId,
    feedback_type: feedbackType,
  });

  if (feedbackType === "hide_creator") {
    const { data: item } = await supabase
      .from("research_items")
      .select("external_creator_id, creator_id")
      .eq("id", itemId)
      .maybeSingle();
    if (item?.creator_id) {
      await supabase
        .from("research_items")
        .update({ hidden: true })
        .eq("user_id", user.id)
        .eq("creator_id", item.creator_id);
    }
  }

  revalidatePath("/research");
}

export async function saveNicheProfileAction(
  _prev: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const split = (value: FormDataEntryValue | null) =>
    String(value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 40);

  const { error } = await supabase.from("niche_profiles").upsert(
    {
      user_id: user.id,
      main_niche: String(formData.get("mainNiche") ?? "").trim().slice(0, 200) || null,
      topics: split(formData.get("topics")),
      keywords: split(formData.get("keywords")),
      target_audience:
        String(formData.get("targetAudience") ?? "").trim().slice(0, 500) || null,
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: error.message };
  revalidatePath("/research");
  return { success: "Niche profile saved." };
}

export async function synthesizeMultiOutliersAction(
  _prev: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const itemIds = formData.getAll("itemIds").map(String).filter(Boolean);
  if (itemIds.length < 2) {
    return { error: "Select at least two research items." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  try {
    const { synthesizeMultiOutliers } = await import(
      "@/lib/research/multi-outlier"
    );
    const text = await synthesizeMultiOutliers({
      supabase,
      userId: user.id,
      itemIds,
    });
    return { success: text };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Synthesis failed.",
    };
  }
}

export async function generateNicheBriefAction(formData: FormData) {
  const topic = String(formData.get("topic") ?? "").trim();
  if (topic.length < 2) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { generateNicheBrief } = await import("@/lib/research/niche-brief");
  const { brief, itemCount, usedLlm } = await generateNicheBrief({
    supabase,
    userId: user.id,
    topic,
    lookbackDays: positiveInteger(formData.get("lookbackDays"), 30),
  });

  await supabase.from("research_scans").insert({
    user_id: user.id,
    name: `Niche brief: ${topic.slice(0, 60)}`,
    query: topic,
    platforms: ["youtube"],
    lookback_days: 30,
    min_views: 0,
    min_outlier_score: 0,
    max_results: 25,
    auto_scan_enabled: false,
    status: "paused",
    parameters: { nicheBrief: brief, itemCount, usedLlm },
  });

  revalidatePath("/research");
  void itemCount;
  void usedLlm;
}

