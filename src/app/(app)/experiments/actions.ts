"use server";

import { revalidatePath } from "next/cache";
import { createExperimentSchema } from "@/lib/growth/schemas";
import { createClient } from "@/lib/supabase/server";

export type ExperimentActionState = {
  error?: string;
  success?: boolean;
};

export async function createExperiment(
  _prev: ExperimentActionState,
  formData: FormData,
): Promise<ExperimentActionState> {
  const parsed = createExperimentSchema.safeParse({
    hypothesis: formData.get("hypothesis"),
    primaryVariable: formData.get("primaryVariable") || null,
    primaryMetric: formData.get("primaryMetric") || null,
    testPlan: formData.get("testPlan") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid experiment." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("content_experiments").insert({
    user_id: user.id,
    hypothesis: parsed.data.hypothesis,
    primary_variable: parsed.data.primaryVariable,
    primary_metric: parsed.data.primaryMetric,
    test_plan: parsed.data.testPlan,
    status: "planned",
    variants: [],
    control_variables: {},
    secondary_metrics: [],
    observations: null,
    conclusion_state: null,
  });

  if (error) return { error: error.message };

  revalidatePath("/experiments");
  return { success: true };
}
