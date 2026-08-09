"use server";

import { revalidatePath } from "next/cache";
import {
  createMilestoneSchema,
  createRoadmapSchema,
} from "@/lib/growth/schemas";
import { createClient } from "@/lib/supabase/server";

export type GrowthActionState = {
  error?: string;
  success?: boolean;
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

export async function createRoadmap(
  _prev: GrowthActionState,
  formData: FormData,
): Promise<GrowthActionState> {
  const parsed = createRoadmapSchema.safeParse({
    goal: formData.get("goal"),
    currentPhase: formData.get("currentPhase") || "foundation",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid roadmap." };
  }

  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const { error } = await auth.supabase.from("creator_roadmaps").insert({
    user_id: auth.user.id,
    goal: parsed.data.goal,
    current_phase: parsed.data.currentPhase,
    status: "active",
    progress_pct: 0,
    metadata: {},
  });

  if (error) return { error: error.message };

  revalidatePath("/roadmap");
  revalidatePath("/today");
  return { success: true };
}

export async function createMilestone(
  _prev: GrowthActionState,
  formData: FormData,
): Promise<GrowthActionState> {
  const parsed = createMilestoneSchema.safeParse({
    roadmapId: formData.get("roadmapId"),
    title: formData.get("title"),
    category: formData.get("category") || "general",
    notes: formData.get("notes") || null,
    deadline: formData.get("deadline") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid milestone." };
  }

  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const { data: roadmap } = await auth.supabase
    .from("creator_roadmaps")
    .select("id")
    .eq("id", parsed.data.roadmapId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!roadmap) return { error: "Roadmap not found." };

  const { count } = await auth.supabase
    .from("roadmap_milestones")
    .select("id", { count: "exact", head: true })
    .eq("roadmap_id", parsed.data.roadmapId);

  const { error } = await auth.supabase.from("roadmap_milestones").insert({
    roadmap_id: parsed.data.roadmapId,
    user_id: auth.user.id,
    title: parsed.data.title,
    category: parsed.data.category,
    notes: parsed.data.notes,
    deadline: parsed.data.deadline || null,
    source_kind: "manual",
    status: "not_started",
    sort_order: count ?? 0,
    evidence: {},
  });

  if (error) return { error: error.message };

  await auth.supabase.from("roadmap_updates").insert({
    roadmap_id: parsed.data.roadmapId,
    user_id: auth.user.id,
    source_kind: "manual",
    summary: `Added milestone: ${parsed.data.title}`,
    details: { category: parsed.data.category },
  });

  revalidatePath("/roadmap");
  return { success: true };
}
