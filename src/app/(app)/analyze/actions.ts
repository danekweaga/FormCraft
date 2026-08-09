"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildFormCraftContext,
  contextToPromptBlock,
} from "@/lib/ai/context/formcraft-context";
import { resolveTaskModel } from "@/lib/ai/models/preferences";
import { analyzeTranscriptWithAi } from "@/lib/analyze/ai";
import { analyzeTranscriptHeuristic } from "@/lib/analyze/heuristic";
import {
  analysisResultSchema,
  createAnalysisInputSchema,
  type AnalysisResult,
} from "@/lib/analyze/schema";
import { hashTranscript } from "@/lib/analyze/transcript-hash";
import { createClient } from "@/lib/supabase/server";

export type AnalyzeActionState = {
  error?: string;
  success?: boolean;
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

export async function createTranscriptAnalysis(
  input: {
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
    parentAnalysisId?: string | null;
    contentPostId?: string | null;
    inputType?:
      | "transcript_paste"
      | "my_content_post"
      | "social_url"
      | "youtube_url"
      | "tiktok_url"
      | "instagram_url";
  },
): Promise<{ error?: string; analysisId?: string }> {
  const parsed = createAnalysisInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid analysis input." };
  }

  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

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

  const transcriptHash = hashTranscript(parsed.data.transcript);
  const heuristic = analyzeTranscriptHeuristic(
    parsed.data.transcript,
    parsed.data.mode,
  );
  const selection = await resolveTaskModel(auth.supabase, {
    userId: auth.user.id,
    taskType: "content_analysis",
  });

  let personalContext: string | null = null;
  if (parsed.data.subjectType === "own_content" || contentPostId) {
    const context = await buildFormCraftContext(auth.supabase, {
      userId: auth.user.id,
      taskType: "content_analysis",
      currentEntityType: contentPostId ? "content_post" : undefined,
      currentEntityId: contentPostId ?? undefined,
      query: parsed.data.transcript.slice(0, 400),
    });
    personalContext = contextToPromptBlock(context);
  }

  const aiAnalysis = await analyzeTranscriptWithAi({
    supabase: auth.supabase,
    userId: auth.user.id,
    transcript: parsed.data.transcript,
    mode: parsed.data.mode,
    subjectType: parsed.data.subjectType,
    heuristic,
    modelTier: selection.modelTier,
    modelName: selection.modelName,
    personalContext,
  });
  const validatedResult = analysisResultSchema.parse(
    aiAnalysis?.result ?? heuristic,
  );

  const { data: analysis, error } = await auth.supabase
    .from("video_analyses")
    .insert({
      user_id: auth.user.id,
      title: parsed.data.title,
      subject_type: parsed.data.subjectType,
      input_type: input.inputType ?? "transcript_paste",
      analysis_mode: parsed.data.mode,
      status: "ready",
      transcript: parsed.data.transcript,
      transcript_hash: transcriptHash,
      content_post_id: contentPostId,
      parent_analysis_id: parsed.data.parentAnalysisId ?? null,
      has_visual_evidence: false,
      has_audio_evidence: false,
      model_name: aiAnalysis?.modelName ?? "heuristic-v1",
      prompt_version: aiAnalysis?.usedLlm
        ? "openrouter-transcript-v2"
        : "heuristic-v1",
      result: validatedResult,
    })
    .select("id")
    .single();

  if (error || !analysis) {
    return { error: error?.message ?? "Failed to save analysis." };
  }

  revalidatePath("/analyze");
  revalidatePath(`/analyze/${analysis.id}`);
  if (contentPostId) revalidatePath(`/my-content/${contentPostId}`);
  return { analysisId: analysis.id };
}

/** Analyze an owned My Content post using caption/transcript as evidence. */
export async function analyzeMyContentPost(
  postId: string,
): Promise<{ error?: string; analysisId?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const { data: post } = await auth.supabase
    .from("content_posts")
    .select("id, title, caption, transcript, platform, source")
    .eq("id", postId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!post) return { error: "Post not found." };

  let transcript = (post.transcript || post.caption || "").trim();
  if (!transcript) {
    return {
      error:
        "This post has no caption or transcript to analyze. Add a transcript first.",
    };
  }
  // Schema requires >= 20 chars; pad honestly when caption is short.
  if (transcript.length < 20) {
    transcript = `${transcript}\n\n[Short caption — limited structural evidence.]`;
  }

  const result = await createTranscriptAnalysis({
    title: post.title || `Analysis: ${post.platform} post`,
    transcript,
    mode: "deep",
    subjectType: "own_content",
    contentPostId: post.id,
    inputType: "my_content_post",
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

export async function reanalyzeTranscript(
  parentAnalysisId: string,
): Promise<{ error?: string; analysisId?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const { data: parent } = await auth.supabase
    .from("video_analyses")
    .select("title, transcript, analysis_mode, subject_type, content_post_id")
    .eq("id", parentAnalysisId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!parent?.transcript) {
    return { error: "Original analysis not found or missing transcript." };
  }

  return createTranscriptAnalysis({
    title: parent.title ? `${parent.title} (reanalysis)` : "Reanalysis",
    transcript: parent.transcript,
    mode: parent.analysis_mode as "quick" | "deep" | "expert",
    subjectType: parent.subject_type as
      | "own_content"
      | "competitor_reference"
      | "viral_outlier"
      | "draft"
      | "unpublished"
      | "unknown",
    parentAnalysisId,
    contentPostId: parent.content_post_id,
  }).then((result) => {
    if (result.analysisId) redirect(`/analyze/${result.analysisId}`);
    return result;
  });
}

/**
 * Create a planned experiment from a high-priority analysis improvement.
 * User confirms by reviewing the draft on /experiments.
 */
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

  const result = analysis.result as AnalysisResult;
  const top =
    result.improvements.find((i) => i.priority === "high") ??
    result.improvements[0];

  if (!top) {
    return { error: "No improvement insight available to experiment on." };
  }

  const hypothesis = `Testing insight from analysis “${analysis.title ?? "Untitled"}”: ${top.suggestion}`;
  const { data, error } = await auth.supabase
    .from("content_experiments")
    .insert({
      user_id: auth.user.id,
      hypothesis: hypothesis.slice(0, 2000),
      primary_variable: top.area.slice(0, 200),
      primary_metric: "relative_views",
      test_plan: [
        `A: Apply — ${top.suggestion}`,
        `B: Control — keep current approach for ${top.area}`,
        "Confirm variants before attaching posts. Do not auto-conclude.",
      ].join("\n"),
      status: "planned",
      variants: [
        { id: "A", label: `Apply: ${top.area}` },
        { id: "B", label: `Control: ${top.area}` },
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
