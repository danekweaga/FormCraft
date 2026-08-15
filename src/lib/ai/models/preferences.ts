import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveModelName, resolveModelTier } from "./router";
import type {
  ContextTaskType,
  ModelTier,
  TaskModelSelection,
} from "./types";

const MODEL_ID_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:-]+$/;

export function isValidOpenRouterModelId(value: string): boolean {
  return value.length <= 200 && MODEL_ID_PATTERN.test(value);
}

function roleToTier(
  role: ModelTier | "multimodal" | undefined,
): ModelTier | null {
  if (!role) return null;
  if (role === "multimodal") return "multimodal";
  return role;
}

export async function resolveTaskModel(
  supabase: SupabaseClient,
  params: {
    userId: string;
    taskType: ContextTaskType;
    preferPremium?: boolean;
    /** Explicit call-site tier wins over the task default when no user preference. */
    role?: ModelTier | "multimodal";
  },
): Promise<TaskModelSelection> {
  const roleTier = roleToTier(params.role);
  const modelTier = params.preferPremium
    ? "premium"
    : (roleTier ?? resolveModelTier(params.taskType));
  const { data } = await supabase
    .from("ai_model_preferences")
    .select("model_name")
    .eq("user_id", params.userId)
    .eq("task_type", params.taskType)
    .maybeSingle();
  const preferred =
    typeof data?.model_name === "string" &&
    isValidOpenRouterModelId(data.model_name)
      ? data.model_name
      : null;

  return {
    taskType: params.taskType,
    modelTier,
    modelName: preferred ?? resolveModelName(modelTier),
    source: preferred ? "preference" : "environment_default",
  };
}

export async function getTaskModelPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<Partial<Record<ContextTaskType, string>>> {
  const { data } = await supabase
    .from("ai_model_preferences")
    .select("task_type, model_name")
    .eq("user_id", userId);
  const preferences: Partial<Record<ContextTaskType, string>> = {};
  for (const row of data ?? []) {
    const taskType = row.task_type as ContextTaskType;
    if (
      typeof row.model_name === "string" &&
      isValidOpenRouterModelId(row.model_name)
    ) {
      preferences[taskType] = row.model_name;
    }
  }
  return preferences;
}

