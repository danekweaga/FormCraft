"use server";

import { revalidatePath } from "next/cache";
import { evaluateIdeaHeuristic } from "@/lib/growth/heuristics";
import { ideaGateSchema } from "@/lib/growth/schemas";
import { createClient } from "@/lib/supabase/server";

export type IdeaGateActionState = {
  error?: string;
  success?: boolean;
  evaluationId?: string;
};

export async function evaluateIdea(
  _prev: IdeaGateActionState,
  formData: FormData,
): Promise<IdeaGateActionState> {
  const parsed = ideaGateSchema.safeParse({
    ideaText: formData.get("ideaText"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid idea." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const heuristic = evaluateIdeaHeuristic(parsed.data.ideaText);

  const { data, error } = await supabase
    .from("idea_gate_evaluations")
    .insert({
      user_id: user.id,
      idea_text: parsed.data.ideaText,
      recommendation: heuristic.recommendation,
      why: `${heuristic.why}\n\n${heuristic.confidenceNote}`,
      evidence: heuristic.evidence,
      risks: heuristic.risks,
      missing_ingredient: heuristic.missingIngredient,
      better_angle: heuristic.betterAngle,
      best_format: heuristic.bestFormat,
      status: "evaluated",
      related_ids: { llm: "deferred" },
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/idea-gate");
  return { success: true, evaluationId: data.id };
}
