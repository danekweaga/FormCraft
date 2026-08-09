"use server";

import { revalidatePath } from "next/cache";
import { splitCommentPaste } from "@/lib/growth/heuristics";
import { pasteCommentsSchema } from "@/lib/growth/schemas";
import { createClient } from "@/lib/supabase/server";

export type AudienceActionState = {
  error?: string;
  success?: boolean;
  inserted?: number;
};

export async function pasteAudienceComments(
  _prev: AudienceActionState,
  formData: FormData,
): Promise<AudienceActionState> {
  const parsed = pasteCommentsSchema.safeParse({
    comments: formData.get("comments"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid comments." };
  }

  const lines = splitCommentPaste(parsed.data.comments);
  if (lines.length === 0) {
    return { error: "Paste at least one non-empty comment line." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const rows = lines.map((body) => ({
    user_id: user.id,
    source: "manual_paste" as const,
    body,
    post_id: null,
    metadata: { ingest: "manual_paste" },
  }));

  const { error } = await supabase.from("audience_comments").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/audience");
  return { success: true, inserted: rows.length };
}
