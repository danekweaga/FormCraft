"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  postsWithUsableText,
  rewriteBioFromPosts,
  type BioRewriteResult,
} from "@/lib/persona/rewrite-bio";
import { createClient } from "@/lib/supabase/server";

const creatorProfileSchema = z.object({
  what_i_make: z
    .string()
    .trim()
    .min(20, "Describe what you make in a little more detail.")
    .max(5000),
  my_audience: z
    .string()
    .trim()
    .min(20, "Describe the audience you want to help.")
    .max(5000),
  content_style: z
    .string()
    .trim()
    .min(20, "Describe how your content should feel.")
    .max(5000),
  script_style: z
    .string()
    .trim()
    .min(20, "Add a real writing or script sample.")
    .max(5000),
  social_bio: z
    .string()
    .trim()
    .max(150, "Keep the social bio within 150 characters."),
  bio_must_include: z.string().trim().max(500).optional().default(""),
  content_pillars: z
    .string()
    .trim()
    .min(2, "Add at least one content pillar.")
    .max(500),
});

export type CreatorProfileActionState = {
  error?: string;
  success?: string;
};

export type BioRewriteActionState = {
  error?: string;
  usedLlm?: boolean;
  result?: BioRewriteResult;
};

export async function saveCreatorProfile(
  _previous: CreatorProfileActionState,
  formData: FormData,
): Promise<CreatorProfileActionState> {
  const parsed = creatorProfileSchema.safeParse({
    what_i_make: formData.get("what_i_make"),
    my_audience: formData.get("my_audience"),
    content_style: formData.get("content_style"),
    script_style: formData.get("script_style"),
    social_bio: formData.get("social_bio"),
    bio_must_include: formData.get("bio_must_include") ?? "",
    content_pillars: formData.get("content_pillars"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check your creator profile.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const contentPillars = Array.from(
    new Set(
      parsed.data.content_pillars
        .split(/[\n,]+/)
        .map((pillar) => pillar.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);
  if (contentPillars.length === 0) {
    return { error: "Add at least one content pillar." };
  }

  const profileData = {
    what_i_make: parsed.data.what_i_make,
    my_audience: parsed.data.my_audience,
    content_style: parsed.data.content_style,
    script_style: parsed.data.script_style,
    social_bio: parsed.data.social_bio,
    bio_must_include: parsed.data.bio_must_include || null,
  };
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      ...profileData,
      content_pillars: contentPillars,
      creator_profile_completed_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) return { error: error.message };

  for (const path of [
    "/persona",
    "/profile",
    "/brand-brain",
    "/today",
    "/research",
    "/create",
  ]) {
    revalidatePath(path);
  }

  return {
    success:
      "Creator profile saved. Future research, ideas, scripts, and reviews will use it.",
  };
}

const mustIncludeSchema = z
  .string()
  .trim()
  .max(500, "Keep must-include notes under 500 characters.");

export async function rewriteBioFromPostsAction(
  mustInclude = "",
): Promise<BioRewriteActionState> {
  const parsedMust = mustIncludeSchema.safeParse(mustInclude);
  if (!parsedMust.success) {
    return {
      error:
        parsedMust.error.issues[0]?.message ??
        "Check the must-include notes for your bio.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const [{ data: profile }, { data: posts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("what_i_make, my_audience, social_bio, content_pillars")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("content_posts")
      .select(
        "title, caption, topic, content_pillar, classification, views, published_at",
      )
      .eq("user_id", user.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(40),
  ]);

  const mapped = (posts ?? []).map((post) => ({
    title: post.title,
    caption: post.caption,
    topic: post.topic,
    contentPillar: post.content_pillar,
    classification:
      post.classification && typeof post.classification === "object"
        ? (post.classification as Record<string, unknown>)
        : null,
    views: post.views,
  }));

  if (postsWithUsableText(mapped).length < 3) {
    return {
      error:
        "Need at least 3 owned posts with titles or captions before rewriting your bio from what you post.",
    };
  }

  try {
    await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          bio_must_include: parsedMust.data || null,
        },
        { onConflict: "id" },
      );

    const { result, usedLlm } = await rewriteBioFromPosts({
      supabase,
      userId: user.id,
      whatIMake: profile?.what_i_make ?? "",
      audience: profile?.my_audience ?? "",
      pillars: profile?.content_pillars ?? [],
      currentBio: profile?.social_bio ?? "",
      mustInclude: parsedMust.data,
      posts: mapped,
    });
    revalidatePath("/persona");
    return { result, usedLlm };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not rewrite bio from your posts.",
    };
  }
}
