"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildFormCraftContext,
  contextToPromptBlock,
} from "@/lib/ai/context/formcraft-context";
import { resolveTaskModel } from "@/lib/ai/models/preferences";
import { normalizeAnalysisResult } from "@/lib/analyze/schema";
import { generateEditingBlueprintWithAi } from "@/lib/editing/copilot-ai";
import { extractReferencePrinciples } from "@/lib/editing/reference-principles";
import type { CreativeDirection } from "@/lib/editing/schema";
import {
  buildMyStylePrinciples,
  listStyleProfiles,
  upsertStyleProfile,
} from "@/lib/editing/style-profiles";
import { reviewScriptHeuristic } from "@/lib/growth/heuristics";
import { reviewScriptLabWithAi } from "@/lib/growth/pre-publish-lab";
import { prePublishSchema } from "@/lib/growth/schemas";
import { createClient } from "@/lib/supabase/server";

export type PrePublishActionState = {
  error?: string;
  success?: boolean;
  reviewId?: string;
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

export async function createPrePublishReview(
  _prev: PrePublishActionState,
  formData: FormData,
): Promise<PrePublishActionState> {
  const runEditing =
    String(formData.get("runEditingCopilot") ?? "") === "true" ||
    String(formData.get("runEditingCopilot") ?? "") === "on";

  const parsed = prePublishSchema.safeParse({
    inputText: formData.get("inputText"),
    sourceRef: formData.get("sourceRef") || null,
    analysisId: formData.get("analysisId") || null,
    contentPostId: formData.get("contentPostId") || null,
    creativeDirection: formData.get("creativeDirection") || null,
    customDirectionBrief: formData.get("customDirectionBrief") || null,
    styleProfileId: formData.get("styleProfileId") || null,
    runEditingCopilot: runEditing,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid script." };
  }

  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) {
    return { error: auth.error ?? "Not signed in" };
  }

  const analysisId = parsed.data.analysisId ?? null;
  const contentPostId = parsed.data.contentPostId ?? null;

  if (analysisId) {
    const { data: owned } = await auth.supabase
      .from("video_analyses")
      .select("id")
      .eq("id", analysisId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!owned) return { error: "Analysis not found." };
  }
  if (contentPostId) {
    const { data: owned } = await auth.supabase
      .from("content_posts")
      .select("id")
      .eq("id", contentPostId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!owned) return { error: "My Content post not found." };
  }

  if (parsed.data.runEditingCopilot && !parsed.data.creativeDirection) {
    return {
      error:
        "Pick a creative direction before running the Editing Copilot (editing is subjective).",
    };
  }

  const heuristic = reviewScriptHeuristic(parsed.data.inputText);
  const context = await buildFormCraftContext(auth.supabase, {
    userId: auth.user.id,
    taskType: "pre_publish_review",
    currentEntityType: contentPostId
      ? "content_post"
      : analysisId
        ? "analysis"
        : undefined,
    currentEntityId: contentPostId ?? analysisId ?? undefined,
    query: parsed.data.inputText.slice(0, 400),
  });
  const personalContext = contextToPromptBlock(context);

  const { data: runningExperiments } = await auth.supabase
    .from("content_experiments")
    .select("id, hypothesis, status, variants")
    .eq("user_id", auth.user.id)
    .in("status", ["running", "planned"])
    .limit(3);

  const activeExperimentNote =
    (runningExperiments ?? []).length > 0
      ? `Active/planned experiments: ${(runningExperiments ?? [])
          .map((e) => e.hypothesis.slice(0, 80))
          .join(" · ")}. Confirm before assigning.`
      : null;

  let analysisSummary: string | null = null;
  let analysisTimeline:
    | Array<{
        startSeconds: number;
        endSeconds: number;
        type: string;
        transcript: string;
      }>
    | undefined;

  if (analysisId) {
    const { data: analysis } = await auth.supabase
      .from("video_analyses")
      .select("title, result")
      .eq("id", analysisId)
      .maybeSingle();
    if (analysis?.result) {
      const normalized = normalizeAnalysisResult(analysis.result);
      analysisSummary = [
        analysis.title,
        normalized.overview.coreMessage,
        `Hooks: ${normalized.hooks.map((h) => h.type).join(", ")}`,
        `Top improvements: ${normalized.improvements
          .slice(0, 3)
          .map((i) => i.issue)
          .join("; ")}`,
        `Evidence findings: ${normalized.evidenceFindings
          .slice(0, 6)
          .map(
            (finding) =>
              `[${finding.evidenceClass}] ${finding.id}: ${finding.statement} (confidence ${finding.confidence}; uncertainty: ${finding.uncertainty})`,
          )
          .join(" | ")}`,
        normalized.personalComparison
          ? `Personal evidence: n=${normalized.personalComparison.sampleSize}, ${normalized.personalComparison.confidence}, ${normalized.personalComparison.note}`
          : "Personal evidence: unavailable",
      ]
        .filter(Boolean)
        .join("\n");
      analysisTimeline = normalized.timeline.map((t) => ({
        startSeconds: t.startSeconds,
        endSeconds: t.endSeconds,
        type: t.type,
        transcript: t.transcript,
      }));
    }
  }

  const selection = await resolveTaskModel(auth.supabase, {
    userId: auth.user.id,
    taskType: "pre_publish_review",
  });

  const lab = await reviewScriptLabWithAi({
    supabase: auth.supabase,
    userId: auth.user.id,
    inputText: parsed.data.inputText,
    heuristic,
    personalContext,
    analysisSummary,
    activeExperimentNote,
    modelTier: selection.modelTier,
    modelName: selection.modelName,
  });

  const labResult = lab?.result;
  if (!labResult) return { error: "Could not produce pre-publish review." };

  let editingPlanId: string | null = null;
  const direction = parsed.data.creativeDirection as CreativeDirection | null;

  if (parsed.data.runEditingCopilot && direction) {
    let stylePrinciples: string[] = [];
    if (direction === "my_style") {
      stylePrinciples = await buildMyStylePrinciples({
        supabase: auth.supabase,
        userId: auth.user.id,
      });
    } else if (parsed.data.styleProfileId) {
      const profiles = await listStyleProfiles({
        supabase: auth.supabase,
        userId: auth.user.id,
      });
      const profile = profiles.find((p) => p.id === parsed.data.styleProfileId);
      stylePrinciples = profile?.principles ?? [];
    } else if (direction === "reference" && analysisId) {
      const { data: analysis } = await auth.supabase
        .from("video_analyses")
        .select("result")
        .eq("id", analysisId)
        .maybeSingle();
      if (analysis?.result) {
        stylePrinciples = extractReferencePrinciples(analysis.result);
      }
    }
    if (parsed.data.customDirectionBrief) {
      stylePrinciples = [
        ...stylePrinciples,
        `Custom brief: ${parsed.data.customDirectionBrief}`,
      ];
    }

    const editSelection = await resolveTaskModel(auth.supabase, {
      userId: auth.user.id,
      taskType: "editing_guidance",
    });

    const { blueprint, modelName } = await generateEditingBlueprintWithAi({
      supabase: auth.supabase,
      userId: auth.user.id,
      script: parsed.data.inputText,
      direction,
      stylePrinciples,
      customBrief: parsed.data.customDirectionBrief,
      analysisTimeline,
      modelName: editSelection.modelName,
      usePremium: false,
    });

    const { data: plan, error: planError } = await auth.supabase
      .from("editing_plans")
      .insert({
        user_id: auth.user.id,
        source_ref: parsed.data.sourceRef,
        title: `Blueprint · ${direction}`,
        creative_direction: direction,
        style_profile_id: parsed.data.styleProfileId ?? null,
        analysis_id: analysisId,
        plan: { ...blueprint, modelName },
      })
      .select("id")
      .single();

    if (!planError && plan) editingPlanId = plan.id;
  }

  const { data, error } = await auth.supabase
    .from("pre_publish_reviews")
    .insert({
      user_id: auth.user.id,
      source_type: analysisId
        ? "analysis"
        : contentPostId
          ? "my_content"
          : "paste",
      source_ref: parsed.data.sourceRef,
      input_text: parsed.data.inputText,
      result: labResult,
      checklist: labResult.checklist,
      status: "reviewed",
      analysis_id: analysisId,
      content_post_id: contentPostId,
      creative_direction: direction,
      editing_plan_id: editingPlanId,
      result_version: "pre-publish-lab-v1",
      // Experiment assignment is opt-in via assignReviewToExperimentAction.
      active_experiment_id: null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to save review." };

  if (editingPlanId) {
    await auth.supabase
      .from("editing_plans")
      .update({ review_id: data.id })
      .eq("id", editingPlanId)
      .eq("user_id", auth.user.id);
  }

  revalidatePath("/pre-publish");
  redirect(`/pre-publish/${data.id}`);
}

export async function updatePrePublishStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user || !id) return;
  if (
    !["draft", "reviewed", "approved", "needs_revision", "archived"].includes(
      status,
    )
  ) {
    return;
  }
  await auth.supabase
    .from("pre_publish_reviews")
    .update({ status })
    .eq("id", id)
    .eq("user_id", auth.user.id);
  revalidatePath("/pre-publish");
  revalidatePath(`/pre-publish/${id}`);
}

export async function assignReviewToExperimentAction(formData: FormData) {
  const reviewId = String(formData.get("reviewId") ?? "");
  const experimentId = String(formData.get("experimentId") ?? "");
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) {
    return { error: auth.error ?? "Not signed in" };
  }
  if (!reviewId || !experimentId) {
    return { error: "Pick an experiment." };
  }

  const { data: experiment } = await auth.supabase
    .from("content_experiments")
    .select("id, control_variables")
    .eq("id", experimentId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!experiment) return { error: "Experiment not found." };

  const control = {
    ...((experiment.control_variables as Record<string, unknown>) ?? {}),
    source_pre_publish_review_id: reviewId,
  };

  await auth.supabase
    .from("content_experiments")
    .update({ control_variables: control })
    .eq("id", experimentId);

  await auth.supabase
    .from("pre_publish_reviews")
    .update({ active_experiment_id: experimentId })
    .eq("id", reviewId)
    .eq("user_id", auth.user.id);

  revalidatePath(`/pre-publish/${reviewId}`);
  revalidatePath("/experiments");
  return { success: true };
}

export async function saveEditingFeedbackAction(formData: FormData) {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return;

  const editingPlanId = String(formData.get("editingPlanId") ?? "") || null;
  const reviewId = String(formData.get("reviewId") ?? "") || null;
  const suggestionKey = String(formData.get("suggestionKey") ?? "").trim();
  const feedback = String(formData.get("feedback") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (
    !suggestionKey ||
    ![
      "good",
      "not_my_style",
      "too_much",
      "too_little",
      "never",
      "save_preference",
    ].includes(feedback)
  ) {
    return;
  }

  await auth.supabase.from("editing_suggestion_feedback").insert({
    user_id: auth.user.id,
    editing_plan_id: editingPlanId,
    review_id: reviewId,
    suggestion_key: suggestionKey.slice(0, 200),
    feedback,
    note,
  });

  if (feedback === "save_preference" && note) {
    await upsertStyleProfile({
      supabase: auth.supabase,
      userId: auth.user.id,
      name: `Preference · ${suggestionKey.slice(0, 40)}`,
      sourceType: "personal",
      principles: [note],
      userConfirmed: true,
    });
  }

  if (reviewId) revalidatePath(`/pre-publish/${reviewId}`);
}

export async function saveEditingPatternFromAnalysisAction(
  formData: FormData,
): Promise<void> {
  const analysisId = String(formData.get("analysisId") ?? "");
  const researchItemId = String(formData.get("researchItemId") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim() || "Editing pattern";
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return;

  let resolvedAnalysisId = analysisId;
  let researchItemIdForProfile: string | null = researchItemId;

  if (!resolvedAnalysisId && researchItemId) {
    const { data: linked } = await auth.supabase
      .from("video_analyses")
      .select("id, research_item_id")
      .eq("user_id", auth.user.id)
      .eq("research_item_id", researchItemId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!linked) return;
    resolvedAnalysisId = linked.id;
    researchItemIdForProfile = linked.research_item_id;
  }

  if (!resolvedAnalysisId) return;

  const { data: analysis } = await auth.supabase
    .from("video_analyses")
    .select("id, result, research_item_id")
    .eq("id", resolvedAnalysisId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!analysis?.result) return;

  const principles = extractReferencePrinciples(analysis.result);
  const saved = await upsertStyleProfile({
    supabase: auth.supabase,
    userId: auth.user.id,
    name,
    sourceType: "reference",
    description: "Saved from Video Breakdown Lab — abstract principles only.",
    principles,
    observedPatterns: principles.slice(0, 4),
    userConfirmed: true,
    sourceAnalysisId: resolvedAnalysisId,
    sourceResearchItemId:
      researchItemIdForProfile ?? analysis.research_item_id,
  });

  if ("error" in saved) return;

  await auth.supabase.from("saved_patterns").insert({
    user_id: auth.user.id,
    name: name.slice(0, 120),
    pattern_type: "editing",
    content: { principles, abstractOnly: true },
    source_analysis_id: resolvedAnalysisId,
  });

  revalidatePath(`/analyze/${resolvedAnalysisId}`);
  revalidatePath("/pre-publish");
  revalidatePath("/research");
}

export async function createPrePublishFromAnalysisAction(formData: FormData) {
  const analysisId = String(formData.get("analysisId") ?? "");
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user || !analysisId) {
    return { error: "Missing analysis." };
  }

  const { data: analysis } = await auth.supabase
    .from("video_analyses")
    .select("id, title, transcript, content_post_id")
    .eq("id", analysisId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!analysis?.transcript || analysis.transcript.trim().length < 20) {
    return { error: "Analysis has no usable transcript." };
  }

  // Build a FormData-like path by calling createPrePublishReview internals via redirect form
  const fd = new FormData();
  fd.set("inputText", analysis.transcript);
  fd.set("sourceRef", analysis.title || "From Analyze");
  fd.set("analysisId", analysisId);
  if (analysis.content_post_id) fd.set("contentPostId", analysis.content_post_id);
  fd.set("creativeDirection", "minimal_yap");
  fd.set("runEditingCopilot", "false");

  return createPrePublishReview({}, fd);
}
