"use server";

import { revalidatePath } from "next/cache";
import { classifyPostHeuristic } from "@/lib/intelligence/classify-post";
import { generateWeeklyReview } from "@/lib/intelligence/weekly-review";
import { createClient } from "@/lib/supabase/server";

export type TopicClassificationState = {
  error?: string;
  success?: string;
  classified?: number;
  remaining?: number;
};

/**
 * Fill missing performance topics from text already owned by the user.
 * This deliberately does not call OpenRouter, Supadata, or any transcript API.
 */
export async function classifyPerformanceTopicsAction(
  _previous: TopicClassificationState,
  _formData: FormData,
): Promise<TopicClassificationState> {
  void _previous;
  void _formData;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: posts, error } = await supabase
    .from("content_posts")
    .select(
      "id, title, caption, transcript, topic, content_pillar, format, duration_seconds, classification, classification_locked",
    )
    .eq("user_id", user.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(250);
  if (error) return { error: error.message };

  const eligible = (posts ?? []).filter(
    (post) =>
      !post.classification_locked &&
      !post.topic?.trim() &&
      Boolean(post.transcript?.trim() || post.caption?.trim() || post.title?.trim()),
  );
  let classified = 0;
  for (const post of eligible) {
    const classification = classifyPostHeuristic({
      title: post.title,
      caption: post.caption,
      transcript: post.transcript,
      format: post.format,
      durationSeconds: post.duration_seconds,
    });
    if (!classification.topic && !classification.content_pillar) continue;
    const source = post.transcript?.trim()
      ? "pasted_transcript"
      : "caption_and_title";
    const { error: updateError } = await supabase
      .from("content_posts")
      .update({
        topic: classification.topic,
        content_pillar:
          classification.content_pillar ?? post.content_pillar ?? null,
        format: classification.format ?? post.format,
        classification: {
          ...((post.classification as Record<string, unknown> | null) ?? {}),
          ...classification,
          classification_source: source,
          used_transcription_api: false,
        },
        classification_confidence: classification.confidence,
        classification_model: "local-topic-rules-v1",
        classified_at: new Date().toISOString(),
      })
      .eq("id", post.id)
      .eq("user_id", user.id);
    if (updateError) return { error: updateError.message };
    classified += 1;
  }

  const remaining = Math.max(0, eligible.length - classified);
  revalidatePath("/performance");
  revalidatePath("/dashboard");
  revalidatePath("/my-content");
  return {
    classified,
    remaining,
    success:
      classified > 0
        ? `Classified ${classified} post${classified === 1 ? "" : "s"} from stored text with zero transcript or AI API credits.${remaining > 0 ? ` ${remaining} still need a pasted transcript or manual topic.` : ""}`
        : "No additional topics could be inferred. Paste a transcript or set a manual topic on the remaining posts.",
  };
}

export async function applySavedTranscriptToPostAction(
  _previous: TopicClassificationState,
  formData: FormData,
): Promise<TopicClassificationState> {
  const postId = String(formData.get("postId") ?? "");
  const reviewId = String(formData.get("reviewId") ?? "");
  if (!postId || !reviewId) {
    return { error: "Pick both the published post and its saved draft." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const [{ data: post }, { data: review }] = await Promise.all([
    supabase
      .from("content_posts")
      .select("id, title, caption, format, duration_seconds, classification, classification_locked")
      .eq("id", postId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("pre_publish_reviews")
      .select("id, input_text")
      .eq("id", reviewId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!post) return { error: "Published post not found." };
  if (!review?.input_text || review.input_text.trim().length < 20) {
    return { error: "That Pre-Publish review has no usable saved transcript." };
  }
  if (post.classification_locked) {
    return {
      error:
        "This post has a locked manual classification. Unlock it in My Content before replacing it.",
    };
  }

  const classification = classifyPostHeuristic({
    title: post.title,
    caption: post.caption,
    transcript: review.input_text,
    format: post.format,
    durationSeconds: post.duration_seconds,
  });
  const { error: updateError } = await supabase
    .from("content_posts")
    .update({
      transcript: review.input_text,
      topic: classification.topic,
      content_pillar: classification.content_pillar,
      format: classification.format ?? post.format,
      classification: {
        ...((post.classification as Record<string, unknown> | null) ?? {}),
        ...classification,
        classification_source: "saved_pre_publish_transcript",
        source_review_id: review.id,
        used_transcription_api: false,
      },
      classification_confidence: classification.confidence,
      classification_model: "local-topic-rules-v1",
      classified_at: new Date().toISOString(),
    })
    .eq("id", post.id)
    .eq("user_id", user.id);
  if (updateError) return { error: updateError.message };

  await supabase
    .from("pre_publish_reviews")
    .update({ content_post_id: post.id })
    .eq("id", review.id)
    .eq("user_id", user.id);
  revalidatePath("/performance");
  revalidatePath("/dashboard");
  revalidatePath(`/my-content/${post.id}`);
  return {
    classified: classification.topic ? 1 : 0,
    remaining: classification.topic ? 0 : 1,
    success: classification.topic
      ? `Reused the saved transcript and classified this post as “${classification.topic}” with zero API credits.`
      : "Saved transcript attached. Set a manual topic in My Content if this niche is not covered by the local classifier yet.",
  };
}

export async function generateWeeklyReviewAction(): Promise<{
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  try {
    await generateWeeklyReview({ supabase, userId: user.id });
    revalidatePath("/dashboard");
    revalidatePath("/performance");
    revalidatePath("/today");
    return {};
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Weekly review failed.",
    };
  }
}

export async function savePostToIdeaBankAction(
  postId: string,
): Promise<{ error?: string; success?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  if (!postId) return { error: "Missing post." };

  const { data: post } = await supabase
    .from("content_posts")
    .select("id, title, caption, external_url, platform, views, hook_text")
    .eq("id", postId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!post) return { error: "Post not found." };

  let collectionId: string | null = null;
  const { data: existing } = await supabase
    .from("knowledge_collections")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", "Idea Bank")
    .maybeSingle();
  if (existing?.id) {
    collectionId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from("knowledge_collections")
      .insert({
        user_id: user.id,
        name: "Idea Bank",
        description:
          "Saved posts from Content Strategy Audit — remake, analyze, or watch later.",
      })
      .select("id")
      .single();
    if (error || !created) {
      return { error: error?.message ?? "Could not create Idea Bank." };
    }
    collectionId = created.id;
  }

  const title =
    post.title?.trim() ||
    post.hook_text?.trim() ||
    post.caption?.trim().slice(0, 80) ||
    "Saved post";
  const body = [
    `Platform: ${post.platform}`,
    post.views != null ? `Views: ${post.views}` : null,
    post.hook_text ? `Hook: ${post.hook_text}` : null,
    post.external_url ? `URL: ${post.external_url}` : null,
    "",
    post.caption?.trim() || "",
    "",
    `My Content: /my-content/${post.id}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const { error: noteError } = await supabase.from("knowledge_documents").insert({
    user_id: user.id,
    collection_id: collectionId,
    title: `Idea · ${title}`.slice(0, 200),
    description: "Saved from Content Strategy Audit",
    source_type: "manual_note",
    knowledge_type: "example",
    raw_text: body,
    include_in_ai: true,
    importance: "normal",
    processing_status: "ready",
  });
  if (noteError) return { error: noteError.message };

  revalidatePath("/knowledge");
  revalidatePath("/performance");
  revalidatePath("/dashboard");
  return { success: "Saved to Idea Bank." };
}

export async function deleteWeeklyReportAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("content_weekly_reports")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/performance");
  revalidatePath("/dashboard");
  revalidatePath("/today");
}
