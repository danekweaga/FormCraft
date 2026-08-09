"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { analyzeTranscriptHeuristic } from "@/lib/analyze/heuristic";
import {
  analysisResultSchema,
  createAnalysisInputSchema,
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
  },
): Promise<{ error?: string; analysisId?: string }> {
  const parsed = createAnalysisInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid analysis input." };
  }

  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const transcriptHash = hashTranscript(parsed.data.transcript);
  const heuristic = analyzeTranscriptHeuristic(
    parsed.data.transcript,
    parsed.data.mode,
  );
  const validatedResult = analysisResultSchema.parse(heuristic);

  const { data: analysis, error } = await auth.supabase
    .from("video_analyses")
    .insert({
      user_id: auth.user.id,
      title: parsed.data.title,
      subject_type: parsed.data.subjectType,
      input_type: "transcript_paste",
      analysis_mode: parsed.data.mode,
      status: "ready",
      transcript: parsed.data.transcript,
      transcript_hash: transcriptHash,
      parent_analysis_id: parsed.data.parentAnalysisId ?? null,
      has_visual_evidence: false,
      has_audio_evidence: false,
      model_name: null,
      prompt_version: "heuristic-v1",
      result: validatedResult,
    })
    .select("id")
    .single();

  if (error || !analysis) {
    return { error: error?.message ?? "Failed to save analysis." };
  }

  revalidatePath("/analyze");
  revalidatePath(`/analyze/${analysis.id}`);
  return { analysisId: analysis.id };
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
    .select("title, transcript, analysis_mode, subject_type")
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
  }).then((result) => {
    if (result.analysisId) redirect(`/analyze/${result.analysisId}`);
    return result;
  });
}
