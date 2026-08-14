import type { ContextTaskType, ModelTier } from "@/lib/ai/models/types";
import { TASK_MODEL_TIER } from "@/lib/ai/models/types";
import type { AIModelRole } from "./types";

export function routeAIModel(input: {
  taskType: ContextTaskType;
  complexity?: "low" | "medium" | "high";
  requiresVision?: boolean;
  userRequestedPremium?: boolean;
}): AIModelRole {
  if (input.requiresVision) return "multimodal";
  if (input.userRequestedPremium) return "premium";
  if (input.complexity === "low") return "cheap";
  if (input.complexity === "high") return "premium";
  return TASK_MODEL_TIER[input.taskType] as AIModelRole;
}

function envModel(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export function resolveModelNameForRole(role: AIModelRole): string {
  if (role === "cheap") {
    return (
      envModel("AI_MODEL_CHEAP", "OPENROUTER_CHEAP_MODEL") ??
      "google/gemini-3.7-flash"
    );
  }
  if (role === "premium") {
    return (
      envModel("AI_MODEL_PREMIUM", "OPENROUTER_PREMIUM_MODEL") ??
      "google/gemini-3.7-flash"
    );
  }
  if (role === "multimodal") {
    return (
      envModel("AI_MODEL_MULTIMODAL", "OPENROUTER_MULTIMODAL_MODEL") ??
      "google/gemini-3.7-flash"
    );
  }
  return (
    envModel("AI_MODEL_STANDARD", "OPENROUTER_STANDARD_MODEL") ??
    "google/gemini-3.7-flash"
  );
}

export function roleToLegacyTier(role: AIModelRole): ModelTier {
  return role;
}
