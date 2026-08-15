"use server";

import { revalidatePath } from "next/cache";
import { buildFormCraftContext } from "@/lib/ai/context/formcraft-context";
import {
  evaluateIdeaWithContext,
  toDbRecommendation,
} from "@/lib/growth/idea-gate-intelligence";
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

  const context = await buildFormCraftContext(supabase, {
    userId: user.id,
    taskType: "idea_evaluation",
    query: parsed.data.ideaText,
  });

  const [{ data: priorPosts }, { data: priorIdeas }] = await Promise.all([
    supabase
      .from("content_posts")
      .select("title, caption")
      .eq("user_id", user.id)
      .limit(40),
    supabase
      .from("idea_gate_evaluations")
      .select("idea_text")
      .eq("user_id", user.id)
      .limit(40),
  ]);

  const priorTexts = [
    ...(priorPosts ?? []).map((p) => `${p.title ?? ""} ${p.caption ?? ""}`),
    ...(priorIdeas ?? []).map((i) => i.idea_text),
  ];

  const decision = await evaluateIdeaWithContext({
    idea: parsed.data.ideaText,
    context,
    priorTexts,
    supabase,
    userId: user.id,
  });

  const { data, error } = await supabase
    .from("idea_gate_evaluations")
    .insert({
      user_id: user.id,
      idea_text: parsed.data.ideaText,
      recommendation: toDbRecommendation(decision.recommendation),
      why: `${decision.summary}\n\nDecision: ${decision.recommendation}`,
      evidence: decision.evidence.map((label) => ({ label })),
      risks: decision.weaknesses.map((label) => ({ label })),
      missing_ingredient: decision.requiredPersonalContext[0] ?? null,
      better_angle: decision.suggestedAngle,
      best_format: decision.suggestedFormat,
      status: "evaluated",
      related_ids: {
        decision,
        sourcesUsed: decision.sourcesUsed,
        contextDebug: context.debug,
      },
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/idea-gate");
  return { success: true, evaluationId: data.id };
}

export async function deleteIdeaGateEvaluationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("idea_gate_evaluations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/idea-gate");
}
