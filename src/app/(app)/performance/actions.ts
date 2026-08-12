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
