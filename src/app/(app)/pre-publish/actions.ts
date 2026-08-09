"use server";

import { revalidatePath } from "next/cache";
import { resolveTaskModel } from "@/lib/ai/models/preferences";
import { reviewScriptHeuristic } from "@/lib/growth/heuristics";
import { reviewScriptWithAi } from "@/lib/growth/pre-publish-ai";
import { prePublishSchema } from "@/lib/growth/schemas";
import { createClient } from "@/lib/supabase/server";

export type PrePublishActionState = {
  error?: string;
  success?: boolean;
  reviewId?: string;
};

export async function createPrePublishReview(
  _prev: PrePublishActionState,
  formData: FormData,
): Promise<PrePublishActionState> {
  const parsed = prePublishSchema.safeParse({
    inputText: formData.get("inputText"),
    sourceRef: formData.get("sourceRef") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid script." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const heuristic = reviewScriptHeuristic(parsed.data.inputText);
  const selection = await resolveTaskModel(supabase, {
    userId: user.id,
    taskType: "pre_publish_review",
  });
  const aiReview = await reviewScriptWithAi({
    supabase,
    userId: user.id,
    inputText: parsed.data.inputText,
    heuristic,
    modelTier: selection.modelTier,
    modelName: selection.modelName,
  });
  const result = aiReview?.result ?? heuristic;

  const { data, error } = await supabase
    .from("pre_publish_reviews")
    .insert({
      user_id: user.id,
      source_type: "paste",
      source_ref: parsed.data.sourceRef,
      input_text: parsed.data.inputText,
      result,
      status: "reviewed",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/pre-publish");
  return { success: true, reviewId: data.id };
}
