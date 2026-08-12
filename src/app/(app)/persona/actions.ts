"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const creatorProfileSchema = z.object({
  what_i_make: z.string().trim().min(20, "Describe what you make in a little more detail.").max(5000),
  my_audience: z.string().trim().min(20, "Describe the audience you want to help.").max(5000),
  content_style: z.string().trim().min(20, "Describe how your content should feel.").max(5000),
  script_style: z.string().trim().min(20, "Add a real writing or script sample.").max(5000),
  social_bio: z.string().trim().max(150, "Keep the social bio within 150 characters."),
  content_pillars: z.string().trim().min(2, "Add at least one content pillar.").max(500),
});

export type CreatorProfileActionState = {
  error?: string;
  success?: string;
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
    content_pillars: formData.get("content_pillars"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your creator profile." };
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

  for (const path of ["/persona", "/profile", "/brand-brain", "/today", "/research", "/create"]) {
    revalidatePath(path);
  }

  return { success: "Creator profile saved. Future research, ideas, scripts, and reviews will use it." };
}
