"use server";

import { revalidatePath } from "next/cache";
import { reviewScriptHeuristic } from "@/lib/growth/heuristics";
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

  const result = reviewScriptHeuristic(parsed.data.inputText);

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
