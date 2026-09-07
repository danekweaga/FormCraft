"use server";

import { revalidatePath } from "next/cache";
import {
  createMilestoneSchema,
  createRoadmapSchema,
} from "@/lib/growth/schemas";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { connectionFollowerCount } from "@/lib/social/freshness";
import { runSocialSync } from "@/lib/social/sync/run-sync";
import { followerProgress, readFollowerGoal } from "@/lib/growth/follower-goal";

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

export async function deleteRoadmapAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user || !id) return;

  await auth.supabase
    .from("creator_roadmaps")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  revalidatePath("/roadmap");
  revalidatePath("/today");
}

export async function deleteMilestoneAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user || !id) return;

  await auth.supabase
    .from("roadmap_milestones")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  revalidatePath("/roadmap");
}

export async function saveFollowerGoal(_prev: GrowthActionState, form: FormData): Promise<GrowthActionState> {
  const parsed = z.object({
    roadmapId: z.string().uuid(), target: z.coerce.number().int().min(1).max(100_000_000),
    current: z.coerce.number().int().min(0).max(1_000_000_000).nullable(),
    connectionId: z.string().uuid().nullable(),
  }).safeParse({ roadmapId: form.get("roadmapId"), target: form.get("target"), current: form.get("current") || null, connectionId: form.get("connectionId") || null });
  if (!parsed.success) return { error: "Enter a valid target and current follower count." };
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return { error: "Sign in to update your goal." };
  const { supabase, user } = auth;
  const { data: roadmap, error: readError } = await supabase.from("creator_roadmaps").select("metadata").eq("id", parsed.data.roadmapId).eq("user_id", user.id).single();
  if (readError || !roadmap) return { error: "Roadmap not found." };
  let current = parsed.data.current;
  let updatedAt: string | null = current == null ? null : new Date().toISOString();
  if (parsed.data.connectionId) {
    const { data: connection } = await supabase.from("social_connections").select("metadata,last_successful_sync_at,use_for_roadmap").eq("id", parsed.data.connectionId).eq("user_id", user.id).eq("account_type", "owned").neq("status", "disconnected").single();
    if (!connection) return { error: "Choose one of your connected accounts." };
    if (!connection.use_for_roadmap) return { error: "Enable Use for roadmap for this account in Connections first." };
    current = connectionFollowerCount(connection.metadata);
    updatedAt = connection.last_successful_sync_at;
  }
  const { error } = await supabase.from("creator_roadmaps").update({
    metadata: { ...roadmap.metadata, follower_goal: { target: parsed.data.target, current, connectionId: parsed.data.connectionId, updatedAt } },
    progress_pct: followerProgress(current, parsed.data.target),
  }).eq("id", parsed.data.roadmapId).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/roadmap");
  return { success: true };
}

export async function refreshRoadmapFollowers(_prev: GrowthActionState, form: FormData): Promise<GrowthActionState> {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return { error: "Sign in to refresh." };
  const { data: roadmap } = await auth.supabase.from("creator_roadmaps").select("metadata").eq("id", String(form.get("roadmapId"))).eq("user_id", auth.user.id).single();
  const goal = readFollowerGoal(roadmap?.metadata ?? null);
  if (!goal?.connectionId) return { error: "Save a connected account for this goal first." };
  try {
    await runSocialSync({ userId: auth.user.id, connectionId: goal.connectionId, syncType: "profile_refresh" });
    revalidatePath("/roadmap");
    revalidatePath("/connections");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Follower refresh failed." };
  }
}

export async function updateMilestoneStatus(_prev: GrowthActionState, form: FormData): Promise<GrowthActionState> {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return { error: "Sign in to update milestones." };
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(["not_started", "in_progress", "done", "blocked", "skipped"]) }).safeParse({ id: form.get("id"), status: form.get("status") });
  if (!parsed.success) return { error: "Invalid milestone status." };
  const { data, error } = await auth.supabase.from("roadmap_milestones").update({ status: parsed.data.status }).eq("id", parsed.data.id).eq("user_id", auth.user.id).select("id").single();
  if (error || !data) return { error: error?.message ?? "Milestone not found." };
  revalidatePath("/roadmap");
  return { success: true };
}
