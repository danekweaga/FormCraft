"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const creatorProfileSchema = z.object({
  what_i_make: z.string().trim().min(20, "Describe what you make in a little more detail.").max(5000),
  my_audience: z.string().trim().min(20, "Describe the audience you want to help.").max(5000),
  content_style: z.string().trim().min(20, "Describe how your content should feel.").max(5000),
  script_style: z.string().trim().min(20, "Add a real writing or script sample.").max(5000),
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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your creator profile." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      ...parsed.data,
      creator_profile_completed_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) return { error: error.message };

  for (const path of ["/persona", "/brand-brain", "/today", "/research", "/create"]) {
    revalidatePath(path);
  }

  return { success: "Creator profile saved. Future research, ideas, scripts, and reviews will use it." };
}
