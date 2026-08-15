import type { ContextTaskType, ModelTier } from "@/lib/ai/models/types";
import {
  DEFAULT_OPENROUTER_MODELS,
  resolveModelName,
} from "@/lib/ai/models/router";
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

export function resolveModelNameForRole(role: AIModelRole): string {
  return resolveModelName(role);
}

export function roleToLegacyTier(role: AIModelRole): ModelTier {
  return role;
}

export { DEFAULT_OPENROUTER_MODELS };
