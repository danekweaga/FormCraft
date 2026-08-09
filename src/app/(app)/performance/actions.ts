"use server";

import { revalidatePath } from "next/cache";
import { generateWeeklyReview } from "@/lib/intelligence/weekly-review";
import { createClient } from "@/lib/supabase/server";

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
