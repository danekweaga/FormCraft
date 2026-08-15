import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

/** Keep under Vercel Hobby 60s: each LLM classify can take several seconds. */
export const MAX_CLASSIFY_PER_PASS = 5;

export type ContentIntelligencePassResult = {
  error?: string;
  classified: number;
  lessons: number;
  insights: number;
  remainingUnclassified: number;
  details: string[];
};

export async function runContentIntelligencePass(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<ContentIntelligencePassResult> {
  const { classifyPost } = await import("@/lib/intelligence/classify-post");
  const { generateSuggestedLessons } = await import(
    "@/lib/intelligence/lesson-engine"
  );
  const { refreshAudienceInsights } = await import(
    "@/lib/intelligence/audience-insights"
  );
  const { resolveTaskModel } = await import("@/lib/ai/models/preferences");

  const classificationModel = await resolveTaskModel(params.supabase, {
    userId: params.userId,
    taskType: "content_classification",
  });

  const { data: unclassified, error: listError } = await params.supabase
    .from("content_posts")
    .select(
      "id, title, caption, transcript, format, duration_seconds, classification_locked, classification",
    )
    .eq("user_id", params.userId)
    .eq("classification_locked", false)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(40);

  if (listError) {
    return {
      error: listError.message,
      classified: 0,
      lessons: 0,
      insights: 0,
      remainingUnclassified: 0,
      details: [],
    };
  }

  const needsClassification = (unclassified ?? []).filter((post) => {
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
    return onlyQueuedStub || !alreadyClassified;
  });

  let classified = 0;
  const details: string[] = [];
  const batch = needsClassification.slice(0, MAX_CLASSIFY_PER_PASS);

  for (const post of batch) {
    const { classification, model } = await classifyPost({
      title: post.title,
      caption: post.caption,
      transcript: post.transcript,
      format: post.format,
      durationSeconds: post.duration_seconds,
      modelName: classificationModel.modelName,
      modelTier: classificationModel.modelTier,
      supabase: params.supabase,
      userId: params.userId,
    });
    const { error: updateError } = await params.supabase
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
      .eq("user_id", params.userId);
    if (updateError) {
      return {
        error: updateError.message,
        classified,
        lessons: 0,
        insights: 0,
        remainingUnclassified: Math.max(
          0,
          needsClassification.length - classified,
        ),
        details,
      };
    }
    classified += 1;
  }

  const remainingUnclassified = Math.max(
    0,
    needsClassification.length - classified,
  );

  if ((unclassified?.length ?? 0) === 0) {
    details.push("No posts found to classify. Sync Instagram first.");
  } else if (classified === 0 && needsClassification.length === 0) {
    details.push("Posts already classified — skipped reclassification.");
  } else if (remainingUnclassified > 0) {
    details.push(
      `Classified ${classified} this pass · ${remainingUnclassified} still need a pass. Run again to continue.`,
    );
  }

  const lessonResult = await generateSuggestedLessons({
    supabase: params.supabase,
    userId: params.userId,
  });
  details.push(...lessonResult.reasons);

  const insights = await refreshAudienceInsights({
    supabase: params.supabase,
    userId: params.userId,
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
    remainingUnclassified,
    details,
  };
}
