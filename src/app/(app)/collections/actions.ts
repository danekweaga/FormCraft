"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FORMAT_LIBRARY } from "@/lib/library/format-library";
import { createClient } from "@/lib/supabase/server";

const formatValues = FORMAT_LIBRARY.map((item) => item.slug) as [string, ...string[]];
const schema = z.object({ postId: z.string().uuid(), format: z.enum(formatValues) });

export async function correctPostFormatAction(formData: FormData) {
  const parsed = schema.safeParse({ postId: formData.get("postId"), format: formData.get("format") });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("content_posts")
    .update({ format: parsed.data.format, classification_locked: true })
    .eq("id", parsed.data.postId)
    .eq("user_id", user.id);
  revalidatePath("/collections");
  revalidatePath(`/my-content/${parsed.data.postId}`);
}
