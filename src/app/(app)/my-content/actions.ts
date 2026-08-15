"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildRelativePerformance,
  computeBaselines,
  shouldFlagNeedsReview,
  shouldFlagWinner,
} from "@/lib/my-content/baseline";
import { manualPostSchema, type ContentPostRow } from "@/lib/my-content/schemas";
import { createClient } from "@/lib/supabase/server";

export type MyContentActionState = {
  error?: string;
  success?: boolean;
  postId?: string;
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

export async function createManualPost(
  _prevState: MyContentActionState,
  formData: FormData,
): Promise<MyContentActionState> {
  const parsed = manualPostSchema.safeParse({
    platform: formData.get("platform"),
    title: formData.get("title") || null,
    caption: formData.get("caption"),
    publishedAt: formData.get("publishedAt") || null,
    views: formData.get("views"),
    likes: formData.get("likes"),
    comments: formData.get("comments"),
    shares: formData.get("shares"),
    saves: formData.get("saves"),
    followers_gained: formData.get("followers_gained"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid post data." };
  }

  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const { data: existingPosts } = await auth.supabase
    .from("content_posts")
    .select(
      "id, views, likes, comments, shares, saves, followers_gained, platform, source, source_label, title, caption, published_at, is_winner, needs_review, relative_performance, created_at",
    )
    .eq("user_id", auth.user.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const posts = (existingPosts ?? []) as ContentPostRow[];
  const baselines = computeBaselines(posts);

  const draftPost: ContentPostRow = {
    id: "draft",
    platform: parsed.data.platform,
    source: "manual_entry",
    source_label: "Manual entry",
    title: parsed.data.title,
    caption: parsed.data.caption,
    published_at: parsed.data.publishedAt,
    views: parsed.data.views,
    likes: parsed.data.likes,
    comments: parsed.data.comments,
    shares: parsed.data.shares,
    saves: parsed.data.saves,
    followers_gained: parsed.data.followers_gained,
    is_winner: false,
    needs_review: false,
    relative_performance: {},
    created_at: new Date().toISOString(),
  };

  const relativePerformance = buildRelativePerformance(
    draftPost,
    posts.slice(0, 10),
    baselines,
  );
  draftPost.relative_performance = relativePerformance;
  draftPost.is_winner = shouldFlagWinner(draftPost, baselines);
  draftPost.needs_review = shouldFlagNeedsReview(draftPost, baselines);

  const { data: post, error } = await auth.supabase
    .from("content_posts")
    .insert({
      user_id: auth.user.id,
      platform: parsed.data.platform,
      source: "manual_entry",
      source_label: "Manual entry",
      title: parsed.data.title,
      caption: parsed.data.caption,
      published_at: parsed.data.publishedAt,
      views: parsed.data.views,
      likes: parsed.data.likes,
      comments: parsed.data.comments,
      shares: parsed.data.shares,
      saves: parsed.data.saves,
      followers_gained: parsed.data.followers_gained,
      is_winner: draftPost.is_winner,
      needs_review: draftPost.needs_review,
      relative_performance: relativePerformance,
    })
    .select("id")
    .single();

  if (error || !post) return { error: error?.message ?? "Failed to save post." };

  revalidatePath("/my-content");
  revalidatePath(`/my-content/${post.id}`);
  redirect(`/my-content/${post.id}`);
}

export async function updateLessonStatus(
  id: string,
  action: "confirm" | "reject" | "keep_testing",
): Promise<{ error?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const status =
    action === "confirm"
      ? "supported"
      : action === "keep_testing"
        ? "testing"
        : "rejected";

  const { error } = await auth.supabase
    .from("performance_lessons")
    .update({
      status,
      last_verified_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };

  await auth.supabase.from("intelligence_feedback").insert({
    user_id: auth.user.id,
    feedback_type: `lesson_${action}`,
    subject_type: "performance_lesson",
    subject_id: id,
    payload: { status },
  });

  revalidatePath("/my-content");
  revalidatePath("/today");
  return {};
}

export async function runContentIntelligenceJob(): Promise<{
  error?: string;
  classified?: number;
  lessons?: number;
  insights?: number;
  remainingUnclassified?: number;
  details?: string[];
}> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) {
    return { error: auth.error ?? "You must be signed in." };
  }

  try {
    const { runContentIntelligencePass } = await import(
      "@/lib/intelligence/run-pass"
    );
    const result = await runContentIntelligencePass({
      supabase: auth.supabase,
      userId: auth.user.id,
      skipAiExtras: true,
    });
    if (result.error) return { error: result.error, details: result.details };
    return {
      classified: result.classified,
      lessons: result.lessons,
      insights: result.insights,
      remainingUnclassified: result.remainingUnclassified,
      details: result.details,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Intelligence pass failed.",
    };
  }
}

export async function deletePost(id: string): Promise<{ error?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const { error } = await auth.supabase
    .from("content_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };

  revalidatePath("/my-content");
  return {};
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deletePost(id);
}
