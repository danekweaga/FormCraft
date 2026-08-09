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
    posts,
    baselines,
  );

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
      is_winner: shouldFlagWinner(draftPost, baselines),
      needs_review: shouldFlagNeedsReview(draftPost, baselines),
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
  action: "confirm" | "reject",
): Promise<{ error?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const status = action === "confirm" ? "confirmed" : "rejected";

  const { error } = await auth.supabase
    .from("performance_lessons")
    .update({ status })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };

  revalidatePath("/my-content");
  return {};
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
