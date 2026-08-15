"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callOpenRouter } from "@/lib/ai/models/openrouter";
import {
  isValidOpenRouterModelId,
  resolveTaskModel,
} from "@/lib/ai/models/preferences";
import {
  CONTEXT_TASK_TYPES,
  type ContextTaskType,
} from "@/lib/ai/models/types";
import { createClient } from "@/lib/supabase/server";

export type ModelSettingsState = {
  error?: string;
  success?: string;
};

const taskTypeSchema = z.enum(CONTEXT_TASK_TYPES);

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function saveModelPreferences(
  _previous: ModelSettingsState,
  formData: FormData,
): Promise<ModelSettingsState> {
  const auth = await requireUser();
  if (!auth) return { error: "You must be signed in." };

  const rows: Array<{
    user_id: string;
    task_type: ContextTaskType;
    model_name: string;
  }> = [];
  const cleared: ContextTaskType[] = [];

  for (const taskType of CONTEXT_TASK_TYPES) {
    const modelName = String(formData.get(taskType) ?? "").trim();
    if (!modelName) {
      cleared.push(taskType);
      continue;
    }
    if (!isValidOpenRouterModelId(modelName)) {
      return { error: `Invalid OpenRouter model ID for ${taskType}.` };
    }
    rows.push({ user_id: auth.user.id, task_type: taskType, model_name: modelName });
  }

  const operations: Array<PromiseLike<{ error: { message: string } | null }>> = [];
  if (rows.length > 0) {
    operations.push(
      auth.supabase
        .from("ai_model_preferences")
        .upsert(rows, { onConflict: "user_id,task_type" }),
    );
  }
  if (cleared.length > 0) {
    operations.push(
      auth.supabase
        .from("ai_model_preferences")
        .delete()
        .eq("user_id", auth.user.id)
        .in("task_type", cleared),
    );
  }
  const results = await Promise.all(operations);
  const error = results.find((result) => result.error)?.error;
  if (error) return { error: error.message };

  revalidatePath("/models");
  return { success: "Model assignments saved." };
}

export async function resetModelPreferencesToDefaults(
  _previous: ModelSettingsState,
  _formData: FormData,
): Promise<ModelSettingsState> {
  void _formData;
  const auth = await requireUser();
  if (!auth) return { error: "You must be signed in." };

  const { error } = await auth.supabase
    .from("ai_model_preferences")
    .delete()
    .eq("user_id", auth.user.id);
  if (error) return { error: error.message };

  revalidatePath("/models");
  return {
    success:
      "Cleared personal overrides. Tasks now use FormCraft defaults: DeepSeek (cheap), Gemini 3.7 Flash (standard), Claude Sonnet 4.6 (premium).",
  };
}

export async function testOpenRouterModel(
  _previous: ModelSettingsState,
  formData: FormData,
): Promise<ModelSettingsState> {
  const auth = await requireUser();
  if (!auth) return { error: "You must be signed in." };
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return {
      error:
        "OPENROUTER_API_KEY is missing. Add it to .env.development.local and restart the dev server.",
    };
  }

  const parsedTask = taskTypeSchema.safeParse(formData.get("taskType"));
  if (!parsedTask.success) return { error: "Choose a valid task." };
  const requestedModel = String(formData.get("modelName") ?? "").trim();
  if (requestedModel && !isValidOpenRouterModelId(requestedModel)) {
    return { error: "Choose a valid OpenRouter model ID." };
  }

  const selection = await resolveTaskModel(auth.supabase, {
    userId: auth.user.id,
    taskType: parsedTask.data,
  });
  try {
    const result = await callOpenRouter({
      tier: selection.modelTier,
      modelName: requestedModel || selection.modelName,
      maxOutputTokens: 12,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: "Reply with exactly: FormCraft connected",
        },
      ],
    });
    if (!result) return { error: "OpenRouter is not configured." };

    await auth.supabase.from("ai_usage_events").insert({
      user_id: auth.user.id,
      task_type: parsedTask.data,
      model_tier: selection.modelTier,
      model_name: result.modelName,
      estimated_input_tokens: result.estimatedInputTokens,
      estimated_output_tokens: result.estimatedOutputTokens,
      estimated_cost_usd: result.actualCostUsd ?? 0,
      metadata: { source: "models_connection_test" },
    });
    return {
      success: `Connected. ${result.modelName} responded successfully.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "OpenRouter test failed.",
    };
  }
}

