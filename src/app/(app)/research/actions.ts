"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { analyzeResearchBatch } from "@/lib/research/analyze";
import { searchablePlatforms } from "@/lib/research/discovery/registry";
import { runResearchScan } from "@/lib/research/run-scan";
import { importCreatorCatalog } from "@/lib/research/import-creator-catalog";
import { normalizeSearchFilters } from "@/lib/research/search-filters";
import type { ResearchPlatform, ScoredResearchVideo } from "@/lib/research/types";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export type ResearchActionState = {
  error?: string;
  success?: string;
  discovered?: number;
  eligible?: number;
  retained?: number;
  providers?: string[];
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
  const selectedPlatforms = formData.getAll("platforms");
  const filters = normalizeSearchFilters({
    query: formData.get("query"),
    platforms: selectedPlatforms.length ? selectedPlatforms : undefined,
    lookbackDays: formData.get("lookbackDays"),
    minViews: formData.get("minViews"),
    minOutlierScore: formData.get("minOutlierScore"),
    maxResults: formData.get("maxResults") ?? 25,
    allowedPlatforms: allowed.length ? allowed : ["youtube"],
    creatorIds: formData.getAll("creatorIds"),
    channelHandles: formData.get("channelHandles"),
    preferNonYoutubeDefault: false,
  });

  if (filters.query.length < 2 || filters.query.length > 160) {
    return { error: "Enter a niche query between 2 and 160 characters." };
  }
  if (filters.platforms.length === 0) {
    return {
      error:
        "Select at least one searchable platform (TikTok when configured, or Include YouTube search).",
    };
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
    parameters: {
      creatorIds: filters.creatorIds,
      channelHandles: filters.channelHandles,
    },
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
    const providersLabel =
      result.providers.length > 0 ? result.providers.join(", ") : "none";
    return {
      discovered: result.discovered,
      eligible: result.eligible,
      retained: result.retained,
      providers: result.providers,
      success: `Discovered ${result.discovered} · eligible ${result.eligible} · retained ${result.retained} (via ${providersLabel}). Deep AI analysis runs only when you click Analyze.`,
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
  const suppliedTranscript = String(formData.get("transcript") ?? "")
    .trim()
    .slice(0, 40_000);
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
  const transcriptsByExternalId = new Map<string, string>();
  if (suppliedTranscript.length >= 20) {
    transcriptsByExternalId.set(video.externalId, suppliedTranscript);
  } else if (reference.platform === "youtube") {
    const { fetchYouTubeTranscript } = await import(
      "@/lib/research/youtube-transcript"
    );
    const publicCaptions = await fetchYouTubeTranscript(video.externalId);
    if (publicCaptions) {
      transcriptsByExternalId.set(video.externalId, publicCaptions);
    }
  }

  const analyzed = await analyzeResearchBatch({
    supabase,
    userId: user.id,
    query: title || "manual reference",
    videos: [video],
    transcriptsByExternalId,
  });
  const result = analyzed.get(video.externalId);
  const transcriptGrounded =
    result?.analysis.evidenceBasis === "metadata_and_transcript";

  const { error } = await supabase.from("research_items").upsert(
    {
      user_id: user.id,
      platform: reference.platform,
      external_id: reference.externalId,
      external_url: reference.normalizedUrl,
      title: title || null,
      description: notes || null,
      hook_text: transcriptGrounded ? result?.analysis.hookText ?? null : null,
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
    success: transcriptGrounded
      ? "Reference saved. The spoken hook was derived from captions/transcript."
      : "Reference saved with metadata only. Add a transcript or use a YouTube video with public captions before analyzing its spoken hook.",
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

  const transcriptsByExternalId = new Map<string, string>();
  if (item.platform === "youtube" && item.external_id) {
    const { fetchYouTubeTranscript } = await import(
      "@/lib/research/youtube-transcript"
    );
    const transcript = await fetchYouTubeTranscript(item.external_id);
    if (transcript) transcriptsByExternalId.set(item.external_id, transcript);
  }

  const analyzed = await analyzeResearchBatch({
    supabase,
    userId: user.id,
    query: item.topic || "outlier analysis",
    videos: [video],
    transcriptsByExternalId,
  });
  const result = analyzed.get(video.externalId);
  if (!result) {
    return {
      error:
        "AI analysis unavailable. Your metrics are safe — retry or continue without AI.",
    };
  }

  const transcriptGrounded =
    result.analysis.evidenceBasis === "metadata_and_transcript";

  await supabase
    .from("research_items")
    .update({
      analysis: result.analysis,
      analysis_model: result.model,
      hook_text: transcriptGrounded ? result.analysis.hookText : null,
      topic: result.analysis.topic ?? item.topic,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/research");
  revalidatePath("/canvas");
  if (item.external_creator_id) {
    revalidatePath(`/research/creators/${item.external_creator_id}`);
  }

  const basis =
    transcriptGrounded
      ? "metadata + public captions/transcript"
      : "metadata-only evidence";
  return {
    success: transcriptGrounded
      ? `Deep analysis complete (${basis}). The hook is transcript-derived.`
      : `Metadata analysis complete (${basis}). Spoken hook analysis was skipped because no transcript was available. Paste or upload a transcript in Analyze.`,
  };
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

/**
 * Sandcastle-style: add a creator by handle to a watchlist, then pull their posts.
 */
export async function addCreatorToWatchlistAction(
  _prev: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const watchlistId = String(formData.get("watchlistId") ?? "");
  const platform = String(formData.get("platform") ?? "tiktok")
    .trim()
    .toLowerCase();
  const handleRaw = String(formData.get("handle") ?? "").trim();
  if (!watchlistId) return { error: "Pick a watchlist." };
  if (handleRaw.length < 2) return { error: "Enter a creator handle." };
  if (platform === "instagram") {
    return {
      error:
        "Instagram creator auto-pull is not available. Paste Reel URLs under Discover → Manual reference, or track TikTok/YouTube creators.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: list } = await supabase
    .from("research_watchlists")
    .select("id")
    .eq("id", watchlistId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!list) return { error: "Watchlist not found." };

  const { resolvePlatformCreatorId, cleanCreatorHandle } = await import(
    "@/lib/research/resolve-creator"
  );
  const { getProviderForPlatform } = await import(
    "@/lib/research/discovery/registry"
  );
  const { ingestScoredPosts } = await import("@/lib/research/ingest-posts");

  const platformCreatorId = await resolvePlatformCreatorId({
    platform,
    handle: handleRaw,
  });
  if (!platformCreatorId) {
    return {
      error:
        platform === "youtube"
          ? "Could not resolve that YouTube handle. Check YOUTUBE_DATA_API_KEY or paste a channel ID (UC…)."
          : "Could not resolve that handle.",
    };
  }

  const handle = cleanCreatorHandle(handleRaw);
  const retrievedAt = new Date().toISOString();
  const { data: creator, error: creatorError } = await supabase
    .from("external_creators")
    .upsert(
      {
        user_id: user.id,
        platform,
        platform_creator_id: platformCreatorId,
        handle,
        display_name: handle,
        data_source:
          platform === "youtube" ? "official_api" : "third_party_api",
        data_freshness_at: retrievedAt,
        tracking_paused: false,
      },
      { onConflict: "user_id,platform,platform_creator_id" },
    )
    .select("id")
    .single();
  if (creatorError || !creator) {
    return { error: creatorError?.message ?? "Could not save creator." };
  }

  const { error: memberError } = await supabase
    .from("research_watchlist_members")
    .upsert(
      {
        watchlist_id: watchlistId,
        external_creator_id: creator.id,
        priority: 0,
      },
      { onConflict: "watchlist_id,external_creator_id" },
    );
  if (memberError) return { error: memberError.message };

  const provider = getProviderForPlatform(platform);
  let pulled = 0;
  if (provider?.getCreatorPosts && provider.capabilities().getCreatorPosts) {
    try {
      const posts = await provider.getCreatorPosts({
        platform: platform as "youtube" | "tiktok",
        platformCreatorId,
        maxResults: 12,
      });
      const { data: niche } = await supabase
        .from("niche_profiles")
        .select("main_niche")
        .eq("user_id", user.id)
        .maybeSingle();
      const ingested = await ingestScoredPosts({
        supabase,
        userId: user.id,
        posts,
        query: niche?.main_niche || handle,
        minViews: 0,
        minOutlierScore: 0,
        retrievedAt,
      });
      pulled = ingested.retained;
      await supabase.from("provider_usage_events").insert({
        user_id: user.id,
        provider: provider.providerName,
        operation: "get_creator_posts",
        result_count: posts.length,
        metadata: { watchlistId, externalCreatorId: creator.id },
      });
      await supabase
        .from("external_creators")
        .update({ data_freshness_at: retrievedAt })
        .eq("id", creator.id);
    } catch (error) {
      revalidatePath("/research");
      return {
        success: `Added @${handle} to the watchlist, but the first pull failed: ${
          error instanceof Error ? error.message : "provider error"
        }. Try Refresh now later.`,
      };
    }
  }

  revalidatePath("/research");
  revalidatePath(`/research/creators/${creator.id}`);
  return {
    success:
      pulled > 0
        ? `Added @${handle} and pulled ${pulled} recent posts (creator-relative outliers scored).`
        : `Added @${handle}. Configure TIKTOK_DATA_API_KEY (or YouTube) then Refresh now to pull posts.`,
  };
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

  const allowed = searchablePlatforms().map((p) => p.platform);
  const selectedPlatforms = formData
    .getAll("platforms")
    .map(String)
    .filter((p) => allowed.includes(p));
  // Default: non-YouTube configured platforms when nothing checked
  const { defaultDiscoveryPlatforms } = await import(
    "@/lib/research/search-filters"
  );
  const platforms =
    selectedPlatforms.length > 0
      ? selectedPlatforms
      : defaultDiscoveryPlatforms(allowed as ResearchPlatform[]);

  const { error } = await supabase.from("niche_profiles").upsert(
    {
      user_id: user.id,
      main_niche: String(formData.get("mainNiche") ?? "").trim().slice(0, 200) || null,
      topics: split(formData.get("topics")),
      keywords: split(formData.get("keywords")),
      target_audience:
        String(formData.get("targetAudience") ?? "").trim().slice(0, 500) || null,
      platforms,
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: error.message };

  const { ensureNicheAutoScan } = await import(
    "@/lib/research/ensure-niche-auto-scan"
  );
  const auto = await ensureNicheAutoScan({ supabase, userId: user.id });
  revalidatePath("/research");
  return {
    success: auto
      ? `Niche profile saved. Auto-scan “${auto.created ? "created" : "updated"}” will refresh discovery on schedule.`
      : "Niche profile saved.",
  };
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
}

export async function refreshWatchlistMonitoringAction(
  _previous: ResearchActionState,
  _formData: FormData,
): Promise<ResearchActionState> {
  void _previous;
  void _formData;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { runWatchlistMonitor } = await import(
    "@/lib/research/watchlist-monitor"
  );
  try {
    // Re-sync the catalog on every manual refresh. Provider credentials may be
    // added after the initial import; without this upsert, creators that were
    // previously marked tracking_paused (notably TikTok) never become active.
    const catalog = await importCreatorCatalog({
      supabase,
      userId: user.id,
    });
    const result = await runWatchlistMonitor({ supabase, userId: user.id });
    revalidatePath("/research");
    if (result.creatorsChecked === 0) {
      return {
        error:
          "No active, supported creator channels were found. Import the creator list and configure a provider for the platform you want to scan.",
      };
    }
    return {
      success: `Synced ${catalog.imported} creator sources (${catalog.trackable} currently API-trackable). Checked ${result.creatorsChecked} supported creator channels, found ${result.discovered} recent short-form posts, and kept ${result.retained}.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Watchlist refresh failed.",
    };
  }
}

/** Pull posts for a single tracked creator (profile / watchlist “Pull posts now”). */
export async function refreshCreatorPostsAction(
  formData: FormData,
): Promise<ResearchActionState> {
  const creatorId = String(formData.get("creatorId") ?? "");
  if (!creatorId) return { error: "Creator id required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  try {
    const { refreshSingleCreatorPosts } = await import(
      "@/lib/research/watchlist-monitor"
    );
    const result = await refreshSingleCreatorPosts({
      supabase,
      userId: user.id,
      externalCreatorId: creatorId,
      maxResults: 15,
    });
    revalidatePath("/research");
    revalidatePath(`/research/creators/${creatorId}`);
    return {
      success: `Pulled posts — kept ${result.retained} (discovered ${result.discovered}).`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Pull failed.",
    };
  }
}

/** Form-action compatible wrapper (must return void). */
export async function pullCreatorPostsFormAction(formData: FormData) {
  await refreshCreatorPostsAction(formData);
}

export async function toggleWatchlistPausedAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const paused = String(formData.get("paused") ?? "") === "true";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !id) return;
  await supabase
    .from("research_watchlists")
    .update({ paused })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/research");
}

export async function saveResearchFilterAction(
  _prev: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const name = String(formData.get("name") ?? "").trim() || "Saved filter";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const filters = {
    keywords: String(formData.get("keywords") ?? ""),
    minOutlier: Number(formData.get("minOutlier") ?? 0),
    maxOutlier: Number(formData.get("maxOutlier") ?? 100),
    minViews: Number(formData.get("minViews") ?? 0),
    maxViews: Number(formData.get("maxViews") ?? 10_000_000),
    minEngagement: Number(formData.get("minEngagement") ?? 0),
    maxEngagement: Number(formData.get("maxEngagement") ?? 100),
    postedWithinValue: Number(formData.get("postedWithinValue") ?? 30),
    postedWithinUnit: String(formData.get("postedWithinUnit") ?? "days"),
    platform: String(formData.get("platform") ?? "all"),
    creator: String(formData.get("creator") ?? "all"),
  };

  const { error } = await supabase.from("research_scans").insert({
    user_id: user.id,
    name: `Filter: ${name.slice(0, 60)}`,
    query: filters.keywords || name,
    platforms:
      filters.platform === "all" ? ["youtube", "tiktok"] : [filters.platform],
    lookback_days: 30,
    min_views: Number.isFinite(filters.minViews) ? filters.minViews : 0,
    min_outlier_score: Number.isFinite(filters.minOutlier)
      ? filters.minOutlier
      : 0,
    max_results: 25,
    auto_scan_enabled: false,
    status: "paused",
    parameters: { savedFilter: filters },
  });
  if (error) return { error: error.message };
  revalidatePath("/research");
  return { success: `Saved filter “${name}”.` };
}

export async function addResearchItemToCanvasAction(formData: FormData) {
  const itemId = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !itemId) return;

  const { addResearchItemToCanvas } = await import("@/lib/canvas/add-from-research");
  const { boardId } = await addResearchItemToCanvas({
    supabase,
    userId: user.id,
    researchItemId: itemId,
  });
  revalidatePath("/canvas");
  revalidatePath(`/canvas/${boardId}`);
  revalidatePath("/research");
}
