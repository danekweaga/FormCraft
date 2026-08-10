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
  details?: string[];
}> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) {
    return { error: auth.error ?? "You must be signed in." };
  }

  try {
    const { classifyPost } = await import("@/lib/intelligence/classify-post");
    const { generateSuggestedLessons } = await import(
      "@/lib/intelligence/lesson-engine"
    );
    const { refreshAudienceInsights } = await import(
      "@/lib/intelligence/audience-insights"
    );
    const { resolveTaskModel } = await import(
      "@/lib/ai/models/preferences"
    );
    const classificationModel = await resolveTaskModel(auth.supabase, {
      userId: auth.user.id,
      taskType: "content_classification",
    });

    const { data: unclassified, error: listError } = await auth.supabase
      .from("content_posts")
      .select(
        "id, title, caption, format, duration_seconds, classification_locked, classification",
      )
      .eq("user_id", auth.user.id)
      .eq("classification_locked", false)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(25);

    if (listError) return { error: listError.message };

    let classified = 0;
    const details: string[] = [];

    for (const post of unclassified ?? []) {
      const existing = post.classification as Record<string, unknown> | null;
      const onlyQueuedStub =
        existing != null &&
        existing.queued === true &&
        Object.keys(existing).every((k) =>
          ["queued", "source", "note"].includes(k),
        );
      const alreadyClassified =
        existing &&
        existing.queued !== true &&
        typeof existing.content_mode === "string";
      if (alreadyClassified && !onlyQueuedStub) continue;

      const { classification, model } = await classifyPost({
        title: post.title,
        caption: post.caption,
        format: post.format,
        durationSeconds: post.duration_seconds,
        modelName: classificationModel.modelName,
        modelTier: classificationModel.modelTier,
        supabase: auth.supabase,
        userId: auth.user.id,
      });
      const { error: updateError } = await auth.supabase
        .from("content_posts")
        .update({
          classification,
          topic: classification.topic,
          content_pillar: classification.content_pillar,
          format: classification.format ?? post.format,
          classification_confidence: classification.confidence,
          classification_model: model,
          classified_at: new Date().toISOString(),
        })
        .eq("id", post.id)
        .eq("user_id", auth.user.id);
      if (updateError) return { error: updateError.message };
      classified += 1;
    }

    if ((unclassified?.length ?? 0) === 0) {
      details.push("No posts found to classify. Sync Instagram first.");
    } else if (classified === 0) {
      details.push("Posts already classified — skipped reclassification.");
    }

    const lessonResult = await generateSuggestedLessons({
      supabase: auth.supabase,
      userId: auth.user.id,
    });
    details.push(...lessonResult.reasons);

    const insights = await refreshAudienceInsights({
      supabase: auth.supabase,
      userId: auth.user.id,
    });
    if (insights === 0) {
      details.push(
        "No audience insights yet — paste 3+ comments on Audience (IG comment import not enabled).",
      );
    }

    revalidatePath("/my-content");
    revalidatePath("/audience");
    revalidatePath("/today");
    return {
      classified,
      lessons: lessonResult.created,
      insights,
      details,
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
