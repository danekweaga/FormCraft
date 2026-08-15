"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { persistCapturedFrames } from "@/lib/analyze/media/frames";
import { persistAnalysisEvidence } from "@/lib/analyze/evidence-store";
import {
  assertAllowedMedia,
  createSignedMediaUrl,
  uploadAnalysisMedia,
} from "@/lib/analyze/media/store";
import {
  captionMetadataTranscript,
  ingestPublicVideoUrl,
} from "@/lib/analyze/ingest/url";
import { runStagedAnalysis } from "@/lib/analyze/pipeline/run-analysis";
import {
  clipAnalysisTitle,
  createAnalysisInputSchema,
  normalizeAnalysisResult,
  subjectToSourceType,
  type AnalysisSourceType,
} from "@/lib/analyze/schema";
import { normalizeTranscriptText } from "@/lib/analyze/transcription/types";
import { getDefaultTranscriptionProvider } from "@/lib/analyze/transcription/whisper-provider";
import { getAnalyzeLimits } from "@/lib/analyze/limits";
import {
  detectObservedRetentionChanges,
  parseRetentionCurve,
} from "@/lib/analyze/retention";
import {
  isPublicTiktokVideoUrl,
  resolveTiktokPublicVideo,
} from "@/lib/research/discovery/tiktok-data-provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AnalyzeActionState = {
  error?: string;
  success?: string;
  analysisId?: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", supabase: null, user: null };
  }

  return { supabase, user, error: null };
}

function urlInputType(platform: string) {
  if (platform === "youtube") return "youtube_url" as const;
  if (platform === "tiktok") return "tiktok_url" as const;
  if (platform === "instagram") return "instagram_url" as const;
  return "social_url" as const;
}

async function recordTranscriptProviderUsage(params: {
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>["supabase"]>;
  userId: string;
  provider: string;
  platform: string;
  billableRequests: number | null;
  source: string;
}) {
  if (!params.provider.startsWith("supadata")) return;
  await params.supabase.from("provider_usage_events").insert({
    user_id: params.userId,
    provider: "supadata",
    operation: "transcript",
    result_count: 1,
    metadata: {
      platform: params.platform,
      billableRequests: params.billableRequests,
      source: params.source,
    },
  });
}

async function nextVersion(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>["supabase"]>,
  userId: string,
  parentId: string | null | undefined,
): Promise<number> {
  if (!parentId) return 1;
  const { data } = await supabase
    .from("video_analyses")
    .select("analysis_version")
    .eq("id", parentId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.analysis_version ?? 1) + 1;
}

export async function createTranscriptAnalysis(input: {
  title: string;
  transcript: string;
  mode: "quick" | "deep" | "expert";
  subjectType:
    | "own_content"
    | "competitor_reference"
    | "viral_outlier"
    | "draft"
    | "unpublished"
    | "unknown";
  sourceType?: AnalysisSourceType;
  parentAnalysisId?: string | null;
  contentPostId?: string | null;
  researchItemId?: string | null;
  inputType?:
    | "transcript_paste"
    | "transcript_file"
    | "my_content_post"
    | "social_url"
    | "youtube_url"
    | "tiktok_url"
    | "instagram_url"
    | "video_upload"
    | "audio_upload"
    | "formcraft_source";
  sourceUrl?: string | null;
  storagePath?: string | null;
  mediaHash?: string | null;
  rawTranscript?: string | null;
  transcriptProvider?: string | null;
  transcriptLanguage?: string | null;
  transcriptConfidence?: number | null;
  timestampedTranscript?: unknown;
  framesAnalyzed?: Array<{ path: string; timestampSeconds: number }>;
  hasVisualEvidence?: boolean;
  hasAudioEvidence?: boolean;
  userCorrections?: Record<string, unknown>;
  usePremium?: boolean;
}): Promise<{ error?: string; analysisId?: string }> {
  const parsed = createAnalysisInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid analysis input." };
  }

  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const limits = getAnalyzeLimits();
  if (parsed.data.transcript.length > limits.maxTranscriptChars) {
    return { error: `Transcript exceeds ${limits.maxTranscriptChars} characters.` };
  }

  const contentPostId = input.contentPostId ?? null;
  if (contentPostId) {
    const { data: owned } = await auth.supabase
      .from("content_posts")
      .select("id")
      .eq("id", contentPostId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!owned) return { error: "My Content post not found." };
  }

  const researchItemId = input.researchItemId ?? null;
  if (researchItemId) {
    const { data: owned } = await auth.supabase
      .from("research_items")
      .select("id")
      .eq("id", researchItemId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!owned) return { error: "Research item not found." };
  }

  const sourceType =
    input.sourceType ??
    subjectToSourceType(parsed.data.subjectType, input.inputType);
  const version = await nextVersion(
    auth.supabase,
    auth.user.id,
    parsed.data.parentAnalysisId,
  );

  const raw = input.rawTranscript ?? parsed.data.transcript;
  const normalized = normalizeTranscriptText(parsed.data.transcript);

  const { data: row, error: insertError } = await auth.supabase
    .from("video_analyses")
    .insert({
      user_id: auth.user.id,
      title: parsed.data.title,
      subject_type: parsed.data.subjectType,
      source_type: sourceType,
      input_type: input.inputType ?? "transcript_paste",
      analysis_mode: parsed.data.mode,
      status: "queued",
      source_url: input.sourceUrl ?? null,
      storage_path: input.storagePath ?? null,
      transcript: normalized,
      raw_transcript: raw,
      normalized_transcript: normalized,
      transcript_hash: null,
      media_hash: input.mediaHash ?? null,
      content_post_id: contentPostId,
      research_item_id: researchItemId,
      parent_analysis_id: parsed.data.parentAnalysisId ?? null,
      has_visual_evidence: Boolean(input.hasVisualEvidence),
      has_audio_evidence: Boolean(input.hasAudioEvidence),
      transcript_provider: input.transcriptProvider ?? "paste",
      transcript_language: input.transcriptLanguage ?? null,
      transcript_confidence: input.transcriptConfidence ?? null,
      timestamped_transcript: input.timestampedTranscript ?? null,
      frames_analyzed: input.framesAnalyzed ?? [],
      analysis_version: version,
      user_corrections: input.userCorrections ?? {},
      processing_stages: [],
      prompt_version: "growth-i-breakdown-v1",
    })
    .select("id")
    .single();

  if (insertError || !row) {
    return { error: insertError?.message ?? "Failed to create analysis." };
  }

  try {
    const timedSegments = Array.isArray(input.timestampedTranscript)
      ? (input.timestampedTranscript as Array<{
          startSeconds: number;
          endSeconds: number;
          text: string;
        }>)
      : undefined;

    const frames = [...(input.framesAnalyzed ?? [])];
    for (const frame of frames) {
      const signed = await createSignedMediaUrl({
        supabase: auth.supabase,
        path: frame.path,
      });
      (frame as { signedUrl?: string | null }).signedUrl = signed;
    }

    const staged = await runStagedAnalysis({
      supabase: auth.supabase,
      userId: auth.user.id,
      analysisId: row.id,
      title: parsed.data.title,
      transcript: normalized,
      mode: parsed.data.mode,
      subjectType: parsed.data.subjectType,
      sourceType,
      contentPostId,
      researchItemId,
      timedSegments,
      frames: frames.map((f) => ({
        path: f.path,
        timestampSeconds: f.timestampSeconds,
        signedUrl: (f as { signedUrl?: string | null }).signedUrl,
      })),
      usePremium: input.usePremium,
      userCorrections: input.userCorrections,
    });

    await auth.supabase
      .from("video_analyses")
      .update({
        status: "ready",
        result: staged.result,
        transcript_hash: staged.transcriptHash,
        input_hash: staged.inputHash,
        context_hash: staged.contextHash,
        processing_stages: staged.stages,
        model_name: staged.modelName,
        prompt_version: staged.promptVersion,
        estimated_cost_usd: staged.estimatedCostUsd,
        knowledge_sources: staged.knowledgeSources,
        has_visual_evidence: Boolean(input.hasVisualEvidence),
        processing_error: null,
      })
      .eq("id", row.id)
      .eq("user_id", auth.user.id);

    await persistAnalysisEvidence({
      supabase: auth.supabase,
      userId: auth.user.id,
      analysisId: row.id,
      result: staged.result,
    });

    const transcriptHook = staged.result.hooks[0]?.text?.trim() || null;
    if (transcriptHook && contentPostId) {
      await auth.supabase
        .from("content_posts")
        .update({ hook_text: transcriptHook.slice(0, 500) })
        .eq("id", contentPostId)
        .eq("user_id", auth.user.id);
    }
    if (transcriptHook && researchItemId) {
      await auth.supabase
        .from("research_items")
        .update({ hook_text: transcriptHook.slice(0, 500) })
        .eq("id", researchItemId)
        .eq("user_id", auth.user.id);
    }
  } catch (error) {
    await auth.supabase
      .from("video_analyses")
      .update({
        status: "failed",
        processing_error:
          error instanceof Error ? error.message.slice(0, 500) : "Analysis failed",
      })
      .eq("id", row.id)
      .eq("user_id", auth.user.id);
    // Media/transcript row retained
    return {
      error:
        error instanceof Error
          ? error.message
          : "Analysis failed — media/transcript were kept.",
      analysisId: row.id,
    };
  }

  revalidatePath("/analyze");
  revalidatePath(`/analyze/${row.id}`);
  if (contentPostId) revalidatePath(`/my-content/${contentPostId}`);
  if (researchItemId) revalidatePath("/research");
  return { analysisId: row.id };
}

export async function analyzeMyContentPost(
  postId: string,
): Promise<{ error?: string; analysisId?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const { data: post } = await auth.supabase
    .from("content_posts")
    .select("id, title, transcript, platform, source, external_url")
    .eq("id", postId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!post) return { error: "Post not found." };

  let transcript = (post.transcript || "").trim();
  let transcriptProvider = transcript ? "cached_content_transcript" : "unavailable";
  let transcriptLanguage: string | null = null;
  let timestampedTranscript: unknown = null;
  if (!transcript && post.external_url) {
    const ingested = await ingestPublicVideoUrl(post.external_url);
    if (ingested.ok) {
      transcript = ingested.transcript;
      transcriptProvider = ingested.transcriptProvider;
      transcriptLanguage = ingested.transcriptLanguage;
      timestampedTranscript = ingested.timestampedTranscript;
      await auth.supabase
        .from("content_posts")
        .update({ transcript })
        .eq("id", post.id)
        .eq("user_id", auth.user.id);
      await recordTranscriptProviderUsage({
        supabase: auth.supabase,
        userId: auth.user.id,
        provider: ingested.transcriptProvider,
        platform: ingested.platform,
        billableRequests: ingested.billableRequests,
        source: "my_content",
      });
    }
  }
  if (transcript.length < 20) {
    return {
      error:
        "No spoken transcript is available for this post. Add a transcript or a supported public video URL. FormCraft will not treat the caption as spoken audio.",
    };
  }

  const result = await createTranscriptAnalysis({
    title: clipAnalysisTitle(
      post.title,
      `Analysis: ${post.platform} post`,
    ),
    transcript,
    mode: "expert",
    subjectType: "own_content",
    sourceType: "my_content",
    contentPostId: post.id,
    inputType: "my_content_post",
    sourceUrl: post.external_url,
    transcriptProvider,
    transcriptLanguage,
    timestampedTranscript,
    hasAudioEvidence: true,
  });
  if (result.analysisId) redirect(`/analyze/${result.analysisId}`);
  return result;
}

export async function createTranscriptAnalysisFromForm(
  _prevState: AnalyzeActionState,
  formData: FormData,
): Promise<AnalyzeActionState> {
  const result = await createTranscriptAnalysis({
    title: String(formData.get("title") ?? ""),
    transcript: String(formData.get("transcript") ?? ""),
    mode: (formData.get("mode") as "quick" | "deep" | "expert") || "deep",
    subjectType:
      (formData.get("subjectType") as
        | "own_content"
        | "competitor_reference"
        | "viral_outlier"
        | "draft"
        | "unpublished"
        | "unknown") || "unknown",
  });

  if (result.error) return { error: result.error };
  redirect(`/analyze/${result.analysisId}`);
}

export async function createAnalysisFromUrlAction(
  _prev: AnalyzeActionState,
  formData: FormData,
): Promise<AnalyzeActionState> {
  const url = String(formData.get("sourceUrl") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || "URL analysis";
  const mode = (formData.get("mode") as "quick" | "deep" | "expert") || "deep";
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) {
    return { error: auth.error ?? "You must be signed in." };
  }
  const ingested = await ingestPublicVideoUrl(url);
  if (!ingested.ok) {
    return { error: `${ingested.reason} ${ingested.suggestion}` };
  }

  const result = await createTranscriptAnalysis({
    title,
    transcript: ingested.transcript,
    mode,
    subjectType: "viral_outlier",
    sourceType: "external_research",
    inputType: urlInputType(ingested.platform),
    sourceUrl: ingested.sourceUrl,
    rawTranscript: ingested.rawTranscript,
    transcriptProvider: ingested.transcriptProvider,
    transcriptLanguage: ingested.transcriptLanguage,
    timestampedTranscript: ingested.timestampedTranscript,
    hasVisualEvidence: false,
    hasAudioEvidence: true,
  });
  if (result.error) return { error: result.error };
  await recordTranscriptProviderUsage({
    supabase: auth.supabase,
    userId: auth.user.id,
    provider: ingested.transcriptProvider,
    platform: ingested.platform,
    billableRequests: ingested.billableRequests,
    source: "analyze_link",
  });
  redirect(`/analyze/${result.analysisId}`);
}

export async function createAnalysisFromUploadAction(
  _prev: AnalyzeActionState,
  formData: FormData,
): Promise<AnalyzeActionState> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) {
    return { error: auth.error ?? "Not signed in" };
  }

  const title = String(formData.get("title") ?? "").trim() || "Uploaded media";
  const mode = (formData.get("mode") as "quick" | "deep" | "expert") || "deep";
  const subjectType =
    (formData.get("subjectType") as
      | "own_content"
      | "competitor_reference"
      | "viral_outlier"
      | "draft"
      | "unpublished"
      | "unknown") || "unpublished";
  const file = formData.get("media");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a video or audio file." };
  }

  const mime = file.type || "application/octet-stream";
  const kind = mime.startsWith("audio/") ? "audio" : "video";
  try {
    assertAllowedMedia({ mimeType: mime, sizeBytes: file.size, kind });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid media" };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Placeholder row for storage path ownership
  const { data: placeholder, error: placeholderError } = await auth.supabase
    .from("video_analyses")
    .insert({
      user_id: auth.user.id,
      title,
      subject_type: subjectType,
      source_type:
        subjectType === "own_content" ? "my_content" : "unpublished_video",
      input_type: kind === "audio" ? "audio_upload" : "video_upload",
      analysis_mode: mode,
      status: "processing",
      processing_stages: [
        { id: "ingest", label: "Video uploaded", status: "done" },
        { id: "transcript", label: "Transcript generated", status: "active" },
      ],
      has_audio_evidence: true,
      has_visual_evidence: kind === "video",
      prompt_version: "growth-i-breakdown-v1",
    })
    .select("id")
    .single();

  if (placeholderError || !placeholder) {
    return { error: placeholderError?.message ?? "Could not start upload." };
  }

  try {
    const uploaded = await uploadAnalysisMedia({
      supabase: auth.supabase,
      userId: auth.user.id,
      analysisId: placeholder.id,
      bytes,
      filename: file.name || `upload.${kind === "audio" ? "mp3" : "mp4"}`,
      mimeType: mime,
      kind,
    });

    const framesJson = String(formData.get("framesJson") ?? "");
    let frames: Array<{ path: string; timestampSeconds: number }> = [];
    if (framesJson) {
      try {
        const parsed = JSON.parse(framesJson) as Array<{
          dataUrl: string;
          timestampSeconds: number;
        }>;
        frames = await persistCapturedFrames({
          supabase: auth.supabase,
          userId: auth.user.id,
          analysisId: placeholder.id,
          frames: parsed,
        });
      } catch {
        // ignore bad frames
      }
    }

    await auth.supabase
      .from("video_analyses")
      .update({
        storage_path: uploaded.path,
        media_hash: uploaded.mediaHash,
        frames_analyzed: frames,
        has_visual_evidence: frames.length > 0 || kind === "video",
      })
      .eq("id", placeholder.id);

    const provider = getDefaultTranscriptionProvider();
    const transcript = await provider.transcribe({
      bytes,
      filename: file.name || "media.mp4",
      mimeType: mime,
    });

    const timedSegments = transcript.segments;
    const framesWithSigned = [];
    for (const frame of frames) {
      const signed = await createSignedMediaUrl({
        supabase: auth.supabase,
        path: frame.path,
      });
      framesWithSigned.push({ ...frame, signedUrl: signed });
    }

    await auth.supabase
      .from("video_analyses")
      .update({
        transcript: transcript.normalizedTranscript,
        raw_transcript: transcript.rawTranscript,
        normalized_transcript: transcript.normalizedTranscript,
        transcript_provider: transcript.provider,
        transcript_language: transcript.language,
        transcript_confidence: transcript.confidence,
        timestamped_transcript: timedSegments,
        processing_stages: [
          { id: "ingest", label: "Video uploaded", status: "done" },
          { id: "transcript", label: "Transcript generated", status: "done" },
          { id: "structure", label: "Structure mapped", status: "active" },
        ],
      })
      .eq("id", placeholder.id);

    const staged = await runStagedAnalysis({
      supabase: auth.supabase,
      userId: auth.user.id,
      analysisId: placeholder.id,
      title,
      transcript: transcript.normalizedTranscript,
      mode,
      subjectType,
      sourceType:
        subjectType === "own_content" ? "my_content" : "unpublished_video",
      timedSegments,
      frames: framesWithSigned,
    });

    await auth.supabase
      .from("video_analyses")
      .update({
        status: "ready",
        result: staged.result,
        transcript_hash: staged.transcriptHash,
        input_hash: staged.inputHash,
        context_hash: staged.contextHash,
        processing_stages: staged.stages,
        model_name: staged.modelName,
        prompt_version: staged.promptVersion,
        estimated_cost_usd: staged.estimatedCostUsd,
        knowledge_sources: staged.knowledgeSources,
        has_visual_evidence: frames.length > 0,
        has_audio_evidence: true,
        processing_error: null,
      })
      .eq("id", placeholder.id);

    await persistAnalysisEvidence({
      supabase: auth.supabase,
      userId: auth.user.id,
      analysisId: placeholder.id,
      result: staged.result,
    });

    revalidatePath("/analyze");
    revalidatePath(`/analyze/${placeholder.id}`);
    redirect(`/analyze/${placeholder.id}`);
  } catch (error) {
    await auth.supabase
      .from("video_analyses")
      .update({
        status: "failed",
        processing_error:
          error instanceof Error ? error.message.slice(0, 500) : "Upload failed",
      })
      .eq("id", placeholder.id);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Upload/transcription failed — retry or paste a transcript.",
      analysisId: placeholder.id,
    };
  }
}

export async function breakDownResearchItemAction(
  researchItemId: string,
): Promise<{ error?: string; analysisId?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const { data: item } = await auth.supabase
    .from("research_items")
    .select(
      "id, title, description, platform, external_id, external_url, creator_name, hook_text, outlier_score, transcript, transcript_provider, transcript_language, transcript_segments",
    )
    .eq("id", researchItemId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!item) return { error: "Research item not found." };

  const { data: previous } = await auth.supabase
    .from("video_analyses")
    .select("transcript, transcript_provider, input_type")
    .eq("research_item_id", item.id)
    .eq("user_id", auth.user.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let transcript = item.transcript?.trim() ?? previous?.transcript?.trim() ?? "";
  let provider =
    item.transcript_provider ?? previous?.transcript_provider ?? "unavailable";
  let language = item.transcript_language ?? null;
  let timestampedTranscript = item.transcript_segments ?? null;
  let inputType:
    | "youtube_url"
    | "tiktok_url"
    | "instagram_url"
    | "social_url"
    | "formcraft_source" =
    previous?.input_type === "youtube_url" ? "youtube_url" : "formcraft_source";
  let hasAudioEvidence = transcript.length >= 20;
  let transcriptFailure: { reason: string; suggestion: string } | null = null;

  let sourceUrl = item.external_url;
  if (
    !transcript &&
    item.platform === "tiktok" &&
    !isPublicTiktokVideoUrl(sourceUrl)
  ) {
    try {
      const repaired = await resolveTiktokPublicVideo({
        title: item.title,
        creatorName: item.creator_name,
      });
      if (repaired) {
        sourceUrl = repaired.externalUrl;
        await auth.supabase
          .from("research_items")
          .update({ external_url: sourceUrl })
          .eq("id", item.id)
          .eq("user_id", auth.user.id);
      } else {
        transcriptFailure = {
          reason:
            "The saved TikTok link used a provider-internal ID and could not be repaired automatically.",
          suggestion:
            "Refresh TikTok discovery, then analyze the newly imported result.",
        };
      }
    } catch (error) {
      transcriptFailure = {
        reason:
          error instanceof Error ? error.message : "TikTok link repair failed.",
        suggestion: "Refresh TikTok discovery and retry.",
      };
    }
  }

  if (!transcript && sourceUrl && !transcriptFailure) {
    // Keep STT short so we leave room for the queued LLM pass (60s total).
    const ingested = await ingestPublicVideoUrl(sourceUrl, { maxPollMs: 20_000 });
    if (ingested.ok) {
      transcript = ingested.transcript;
      provider = ingested.transcriptProvider;
      language = ingested.transcriptLanguage;
      timestampedTranscript = ingested.timestampedTranscript;
      inputType = urlInputType(ingested.platform);
      hasAudioEvidence = true;
      await auth.supabase
        .from("research_items")
        .update({
          transcript,
          transcript_provider: provider,
          transcript_language: language,
          transcript_segments: timestampedTranscript,
          transcript_retrieved_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("user_id", auth.user.id);
      await recordTranscriptProviderUsage({
        supabase: auth.supabase,
        userId: auth.user.id,
        provider,
        platform: ingested.platform,
        billableRequests: ingested.billableRequests,
        source: "research_breakdown",
      });
    } else {
      transcriptFailure = {
        reason: ingested.reason,
        suggestion: ingested.suggestion,
      };
      console.warn("[research:transcript] retrieval failed", {
        researchItemId: item.id,
        platform: item.platform,
        reason: ingested.reason,
      });
    }
  }

  if (transcript.length < 20) {
    const caption = captionMetadataTranscript({
      title: item.title,
      description: item.description,
      hookText: item.hook_text,
    });
    if (caption) {
      transcript = caption;
      provider = "caption_metadata";
      language = null;
      timestampedTranscript = null;
      hasAudioEvidence = false;
      if (item.platform === "tiktok") inputType = "tiktok_url";
      else if (item.platform === "instagram") inputType = "instagram_url";
      else if (item.platform === "youtube") inputType = "youtube_url";
    }
  }

  if (transcript.length < 20) {
    return {
      error: transcriptFailure
        ? `Transcript unavailable: ${transcriptFailure.reason} ${transcriptFailure.suggestion}`
        : "This video has no saved transcript, caption, or public video link. Paste or upload its transcript in Analyze.",
    };
  }

  const title = clipAnalysisTitle(item.title, "Research breakdown");
  const normalized = normalizeTranscriptText(transcript);
  const { data: placeholder, error: placeholderError } = await auth.supabase
    .from("video_analyses")
    .insert({
      user_id: auth.user.id,
      title,
      subject_type: "viral_outlier",
      source_type: "external_research",
      input_type: inputType,
      analysis_mode: "deep",
      status: "processing",
      source_url: sourceUrl,
      transcript: normalized,
      raw_transcript: transcript,
      normalized_transcript: normalized,
      research_item_id: item.id,
      has_visual_evidence: false,
      has_audio_evidence: hasAudioEvidence,
      transcript_provider: provider,
      transcript_language: language,
      timestamped_transcript: timestampedTranscript,
      frames_analyzed: [],
      analysis_version: 1,
      processing_stages: [
        {
          id: "ingest",
          label: "Research item loaded",
          status: "done",
        },
        {
          id: "transcript",
          label: hasAudioEvidence
            ? "Spoken transcript ready"
            : "Using on-screen caption (spoken transcript timed out)",
          status: "done",
          detail: hasAudioEvidence
            ? undefined
            : "Caption is not spoken words — retry Analyze later for speech-to-text.",
        },
        { id: "structure", label: "Structure mapped", status: "active" },
      ],
      prompt_version: "growth-i-breakdown-v1",
    })
    .select("id")
    .single();

  if (placeholderError || !placeholder) {
    return {
      error: placeholderError?.message ?? "Could not start analysis.",
    };
  }

  const analysisId = placeholder.id;
  const userId = auth.user.id;
  const timedSegments = Array.isArray(timestampedTranscript)
    ? (timestampedTranscript as Array<{
        startSeconds: number;
        endSeconds: number;
        text: string;
      }>)
    : undefined;

  after(() => {
    void (async () => {
      const admin = createAdminClient();
      try {
        const staged = await runStagedAnalysis({
          supabase: admin,
          userId,
          analysisId,
          title,
          transcript: normalized,
          mode: "deep",
          subjectType: "viral_outlier",
          sourceType: "external_research",
          researchItemId: item.id,
          timedSegments,
          frames: [],
        });
        await admin
          .from("video_analyses")
          .update({
            status: "ready",
            result: staged.result,
            transcript_hash: staged.transcriptHash,
            input_hash: staged.inputHash,
            context_hash: staged.contextHash,
            processing_stages: staged.stages,
            model_name: staged.modelName,
            prompt_version: staged.promptVersion,
            estimated_cost_usd: staged.estimatedCostUsd,
            knowledge_sources: staged.knowledgeSources,
            has_audio_evidence: hasAudioEvidence,
            processing_error: null,
          })
          .eq("id", analysisId)
          .eq("user_id", userId);

        await persistAnalysisEvidence({
          supabase: admin,
          userId,
          analysisId,
          result: staged.result,
        });

        const transcriptHook = staged.result.hooks[0]?.text?.trim() || null;
        if (transcriptHook) {
          await admin
            .from("research_items")
            .update({ hook_text: transcriptHook.slice(0, 500) })
            .eq("id", item.id)
            .eq("user_id", userId);
        }
      } catch (error) {
        await admin
          .from("video_analyses")
          .update({
            status: "failed",
            processing_error:
              error instanceof Error
                ? error.message.slice(0, 500)
                : "Analysis failed",
          })
          .eq("id", analysisId)
          .eq("user_id", userId);
        console.error(
          `[analyze] deferred research breakdown failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    })();
  });

  revalidatePath("/analyze");
  revalidatePath(`/analyze/${analysisId}`);
  revalidatePath("/research");
  return { analysisId };
}

export async function reanalyzeTranscript(
  parentAnalysisId: string,
  options?: { usePremium?: boolean; mode?: "quick" | "deep" | "expert" },
): Promise<{ error?: string; analysisId?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const { data: parent } = await auth.supabase
    .from("video_analyses")
    .select(
      "title, transcript, raw_transcript, analysis_mode, subject_type, source_type, content_post_id, research_item_id, input_type, source_url, storage_path, media_hash, frames_analyzed, has_visual_evidence, has_audio_evidence, user_corrections, transcript_provider, timestamped_transcript",
    )
    .eq("id", parentAnalysisId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!parent?.transcript) {
    return { error: "Original analysis not found or missing transcript." };
  }

  return createTranscriptAnalysis({
    title: clipAnalysisTitle(
      parent.title ? `${parent.title} (reanalysis)` : null,
      "Reanalysis",
    ),
    transcript: parent.transcript,
    rawTranscript: parent.raw_transcript,
    mode: options?.mode ?? (parent.analysis_mode as "quick" | "deep" | "expert"),
    subjectType: parent.subject_type as
      | "own_content"
      | "competitor_reference"
      | "viral_outlier"
      | "draft"
      | "unpublished"
      | "unknown",
    sourceType: parent.source_type as AnalysisSourceType | undefined,
    parentAnalysisId,
    contentPostId: parent.content_post_id,
    researchItemId: parent.research_item_id,
    inputType: parent.input_type as never,
    sourceUrl: parent.source_url,
    storagePath: parent.storage_path,
    mediaHash: parent.media_hash,
    framesAnalyzed: (parent.frames_analyzed as Array<{
      path: string;
      timestampSeconds: number;
    }>) ?? [],
    hasVisualEvidence: parent.has_visual_evidence,
    hasAudioEvidence: parent.has_audio_evidence,
    userCorrections: (parent.user_corrections as Record<string, unknown>) ?? {},
    transcriptProvider: parent.transcript_provider,
    timestampedTranscript: parent.timestamped_transcript,
    usePremium: options?.usePremium,
  }).then((result) => {
    if (result.analysisId) redirect(`/analyze/${result.analysisId}`);
    return result;
  });
}

export async function saveAnalysisCorrectionsAction(formData: FormData) {
  const analysisId = String(formData.get("analysisId") ?? "");
  const hookType = String(formData.get("hookType") ?? "").trim();
  const sectionIndex = String(formData.get("sectionIndex") ?? "");
  const sectionLabel = String(formData.get("sectionLabel") ?? "").trim();

  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user || !analysisId) return;

  const { data: row } = await auth.supabase
    .from("video_analyses")
    .select("user_corrections, result")
    .eq("id", analysisId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!row) return;

  const corrections = {
    ...((row.user_corrections as Record<string, unknown>) ?? {}),
  } as Record<string, unknown>;
  if (hookType) corrections.hookType = hookType;
  if (sectionIndex && sectionLabel) {
    const labels = {
      ...((corrections.sectionLabels as Record<string, string>) ?? {}),
      [sectionIndex]: sectionLabel,
    };
    corrections.sectionLabels = labels;
  }

  const result = normalizeAnalysisResult(row.result);
  const mergedHooks =
    typeof corrections.hookType === "string" && result.hooks[0]
      ? [{ ...result.hooks[0], type: String(corrections.hookType) }, ...result.hooks.slice(1)]
      : result.hooks;
  const labels = corrections.sectionLabels as Record<string, string> | undefined;
  const mergedTimeline = labels
    ? result.timeline.map((t, i) =>
        labels[String(i)] ? { ...t, type: labels[String(i)]! } : t,
      )
    : result.timeline;

  await auth.supabase
    .from("video_analyses")
    .update({
      user_corrections: corrections,
      result: { ...result, hooks: mergedHooks, timeline: mergedTimeline },
    })
    .eq("id", analysisId)
    .eq("user_id", auth.user.id);

  revalidatePath(`/analyze/${analysisId}`);
}

export async function attachRetentionCurveAction(
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const analysisId = String(formData.get("analysisId") ?? "");
  const rawCurve = String(formData.get("retentionCurve") ?? "").trim();
  const sourceLabel = String(formData.get("sourceLabel") ?? "Manual import").trim();
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) {
    return { error: auth.error ?? "Not signed in." };
  }
  if (!analysisId || !rawCurve) {
    return { error: "Paste a retention curve first." };
  }

  const { data: analysis } = await auth.supabase
    .from("video_analyses")
    .select("id, result")
    .eq("id", analysisId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!analysis?.result) return { error: "Analysis not found." };

  const result = normalizeAnalysisResult(analysis.result);
  const duration = Math.max(1, ...result.timeline.map((item) => item.endSeconds));
  let points;
  try {
    points = parseRetentionCurve(rawCurve, duration);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid retention curve.",
    };
  }

  const { data: curve, error: curveError } = await auth.supabase
    .from("analysis_retention_curves")
    .insert({
      user_id: auth.user.id,
      analysis_id: analysisId,
      provider: "manual",
      source_label: sourceLabel.slice(0, 200),
      duration_seconds: duration,
    })
    .select("id")
    .single();
  if (curveError || !curve) {
    return { error: curveError?.message ?? "Could not save retention curve." };
  }

  const { error: pointError } = await auth.supabase
    .from("analysis_retention_points")
    .insert(
      points.map((point) => ({
        user_id: auth.user.id,
        curve_id: curve.id,
        elapsed_seconds: point.elapsedSeconds,
        position_ratio: point.positionRatio,
        audience_watch_ratio: point.audienceWatchRatio,
      })),
    );
  if (pointError) return { error: pointError.message };

  const observedRetention = detectObservedRetentionChanges(points);
  const evidenceFindings = [
    ...result.evidenceFindings.filter(
      (finding) => finding.evidenceClass !== "observed",
    ),
    ...observedRetention.map((change, index) => ({
      id: `finding:observed-retention:${index}`,
      evidenceClass: "observed" as const,
      title: "Observed retention drop",
      statement: change.note,
      startSeconds: change.startSeconds,
      endSeconds: change.endSeconds,
      evidenceIds: [`retention:${curve.id}:${index}`],
      psychologyPrincipleNames: [] as string[],
      confidence: "high" as const,
      uncertainty:
        "The curve shows viewer behavior but does not prove why the change occurred.",
      suggestedExperiment: null,
    })),
  ];
  const attentionSupport = result.attentionSupport.map((item) =>
    item.dimension === "observed_retention"
      ? {
          ...item,
          status: observedRetention.length ? ("mixed" as const) : ("supportive" as const),
          evidence: observedRetention.length
            ? `${observedRetention.length} significant observed decline interval(s) detected.`
            : "No persistent decline above the conservative five-point threshold was detected.",
        }
      : item,
  );
  const updated = {
    ...result,
    observedRetention,
    evidenceFindings,
    attentionSupport,
    confidenceNotes: [
      ...result.confidenceNotes.filter(
        (note) => !note.startsWith("Observed retention curve:"),
      ),
      `Observed retention curve: ${points.length} points from ${sourceLabel || "manual import"}. Values above 100% are preserved as replay behavior.`,
    ],
  };

  const { error: updateError } = await auth.supabase
    .from("video_analyses")
    .update({ result: updated })
    .eq("id", analysisId)
    .eq("user_id", auth.user.id);
  if (updateError) return { error: updateError.message };

  await persistAnalysisEvidence({
    supabase: auth.supabase,
    userId: auth.user.id,
    analysisId,
    result: updated,
  });
  revalidatePath(`/analyze/${analysisId}`);
  return {
    success: `Saved ${points.length} retention points and found ${observedRetention.length} significant decline interval(s).`,
  };
}

export async function toggleAnalysisSavedAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const saved = String(formData.get("saved") ?? "") === "true";
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user || !id) return;
  await auth.supabase
    .from("video_analyses")
    .update({ saved })
    .eq("id", id)
    .eq("user_id", auth.user.id);
  revalidatePath("/analyze");
  revalidatePath(`/analyze/${id}`);
}

export async function savePatternFromAnalysisAction(formData: FormData) {
  const analysisId = String(formData.get("analysisId") ?? "");
  const name = String(formData.get("name") ?? "").trim() || "Saved pattern";
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user || !analysisId) {
    return;
  }

  const { data: analysis } = await auth.supabase
    .from("video_analyses")
    .select("id, result, content_post_id")
    .eq("id", analysisId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!analysis?.result) return;

  const result = normalizeAnalysisResult(analysis.result);
  const pattern =
    result.improvedStructure.map((s) => s.section).join(" → ") ||
    result.hooks[0]?.type ||
    "Reusable structure";

  await auth.supabase.from("saved_patterns").insert({
    user_id: auth.user.id,
    name: name.slice(0, 120),
    pattern_type: "structure",
    content: {
      pattern,
      hookType: result.hooks[0]?.type ?? null,
      mechanisms: result.hookStack?.mechanisms ?? [],
      improvedStructure: result.improvedStructure,
      abstractOnly: true,
    },
    source_analysis_id: analysisId,
    source_post_id: analysis.content_post_id,
  });

  revalidatePath(`/analyze/${analysisId}`);
  revalidatePath("/analyze");
}

export async function createExperimentFromInsight(
  analysisId: string,
): Promise<{ error?: string; experimentId?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const { data: analysis } = await auth.supabase
    .from("video_analyses")
    .select("id, title, result")
    .eq("id", analysisId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!analysis?.result) return { error: "Analysis not found." };

  const result = normalizeAnalysisResult(analysis.result);
  const top =
    result.improvements.find((i) => i.priority === "high") ??
    result.improvements[0];

  if (!top) {
    return { error: "No improvement insight available to experiment on." };
  }

  const area = top.area ?? top.issue;
  const suggestion = top.suggestion ?? top.recommendation;
  const hypothesis = `Testing insight from analysis “${analysis.title ?? "Untitled"}”: ${suggestion}`;
  const { data, error } = await auth.supabase
    .from("content_experiments")
    .insert({
      user_id: auth.user.id,
      hypothesis: hypothesis.slice(0, 2000),
      primary_variable: area.slice(0, 200),
      primary_metric: "relative_views",
      test_plan: [
        `A: Apply — ${suggestion}`,
        `B: Control — keep current approach for ${area}`,
        "Confirm variants before attaching posts. Do not auto-conclude.",
      ].join("\n"),
      status: "planned",
      variants: [
        { id: "A", label: `Apply: ${area}` },
        { id: "B", label: `Control: ${area}` },
      ],
      control_variables: { source_analysis_id: analysisId },
      secondary_metrics: [],
      observations: null,
      conclusion_state: null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create experiment." };
  }

  revalidatePath("/experiments");
  revalidatePath(`/analyze/${analysisId}`);
  redirect(`/experiments`);
}

export async function compareAnalysesAction(formData: FormData) {
  const leftId = String(formData.get("leftId") ?? "");
  const rightId = String(formData.get("rightId") ?? "");
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) {
    return { error: auth.error ?? "Not signed in" };
  }
  if (!leftId || !rightId || leftId === rightId) {
    return { error: "Pick two different analyses." };
  }

  const { data: rows } = await auth.supabase
    .from("video_analyses")
    .select("id, title, result, subject_type, source_type")
    .eq("user_id", auth.user.id)
    .in("id", [leftId, rightId]);

  const left = rows?.find((r) => r.id === leftId);
  const right = rows?.find((r) => r.id === rightId);
  if (!left?.result || !right?.result) {
    return { error: "Both analyses must be ready." };
  }

  const leftResult = normalizeAnalysisResult(left.result);
  const rightResult = normalizeAnalysisResult(right.result);

  const comparison = {
    hooks: {
      left: leftResult.hooks[0]?.text ?? null,
      right: rightResult.hooks[0]?.text ?? null,
      leftType: leftResult.hooks[0]?.type ?? null,
      rightType: rightResult.hooks[0]?.type ?? null,
    },
    structure: {
      left: leftResult.timeline.map((t) => t.type),
      right: rightResult.timeline.map((t) => t.type),
    },
    rehooks: {
      left: leftResult.rehooks.length,
      right: rightResult.rehooks.length,
    },
    scorecard: leftResult.scorecard.map((s) => ({
      category: s.category,
      left: s.rating,
      right:
        rightResult.scorecard.find((r) => r.category === s.category)?.rating ??
        "Unable to Evaluate",
    })),
    note: "Comparison is structural — higher views on an external post does not mean it is better for you.",
  };

  const { data: saved, error } = await auth.supabase
    .from("analysis_comparisons")
    .insert({
      user_id: auth.user.id,
      left_analysis_id: leftId,
      right_analysis_id: rightId,
      comparison_type: "side_by_side",
      result: comparison,
    })
    .select("id")
    .single();

  if (error || !saved) return { error: error?.message ?? "Compare failed" };
  revalidatePath("/analyze");
  redirect(`/analyze?tab=compare&comparison=${saved.id}`);
}

export async function addAnalysisToCanvasAction(formData: FormData) {
  const analysisId = String(formData.get("analysisId") ?? "");
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user || !analysisId) return;

  const { data: analysis } = await auth.supabase
    .from("video_analyses")
    .select("id, title, result, research_item_id")
    .eq("id", analysisId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!analysis) return;

  if (analysis.research_item_id) {
    const { addResearchItemToCanvas } = await import(
      "@/lib/canvas/add-from-research"
    );
    const { boardId } = await addResearchItemToCanvas({
      supabase: auth.supabase,
      userId: auth.user.id,
      researchItemId: analysis.research_item_id,
    });
    revalidatePath("/canvas");
    revalidatePath(`/canvas/${boardId}`);
    revalidatePath(`/analyze/${analysisId}`);
    return;
  }

  const { addEntityToCanvas } = await import("@/lib/canvas/add-entity");
  const result = normalizeAnalysisResult(analysis.result);
  const { boardId } = await addEntityToCanvas({
    supabase: auth.supabase,
    userId: auth.user.id,
    nodeType: "analysis",
    title: analysis.title || "Breakdown",
    body: result.overview.coreMessage.slice(0, 400),
    analysisId,
    payload: { analysisId, overview: result.overview },
  });

  revalidatePath("/canvas");
  revalidatePath(`/canvas/${boardId}`);
  revalidatePath(`/analyze/${analysisId}`);
}

export async function deleteVideoAnalysisAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user || !id) return;

  const { data: analysis } = await auth.supabase
    .from("video_analyses")
    .select("id, storage_path")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!analysis) return;

  if (analysis.storage_path) {
    await auth.supabase.storage
      .from("analysis-media")
      .remove([analysis.storage_path]);
  }

  await auth.supabase
    .from("video_analyses")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  revalidatePath("/analyze");
  redirect("/analyze");
}

export async function deleteSavedPatternAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user || !id) return;

  await auth.supabase
    .from("saved_patterns")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  revalidatePath("/analyze");
  revalidatePath("/library");
}

export async function deleteAnalysisComparisonAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user || !id) return;

  await auth.supabase
    .from("analysis_comparisons")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  revalidatePath("/analyze");
  redirect("/analyze?tab=compare");
}
