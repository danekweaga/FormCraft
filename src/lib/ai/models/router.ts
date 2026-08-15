import type { ContextTaskType, ModelTier } from "./types";
import { TASK_MODEL_TIER } from "./types";

export function resolveModelTier(
  taskType: ContextTaskType,
  preferPremium = false,
): ModelTier {
  if (preferPremium) return "premium";
  return TASK_MODEL_TIER[taskType];
}

/** OpenRouter defaults — override per env without collapsing every tier to one model. */
export const DEFAULT_OPENROUTER_MODELS = {
  cheap: "deepseek/deepseek-v4-flash-0731",
  standard: "google/gemini-3.7-flash",
  premium: "anthropic/claude-sonnet-4.6",
  multimodal: "google/gemini-3.7-flash",
} as const satisfies Record<ModelTier, string>;

export function resolveModelName(tier: ModelTier): string {
  if (tier === "cheap") {
    return (
      process.env.AI_MODEL_CHEAP?.trim() ||
      process.env.OPENROUTER_CHEAP_MODEL?.trim() ||
      DEFAULT_OPENROUTER_MODELS.cheap
    );
  }
  if (tier === "premium") {
    return (
      process.env.AI_MODEL_PREMIUM?.trim() ||
      process.env.OPENROUTER_PREMIUM_MODEL?.trim() ||
      DEFAULT_OPENROUTER_MODELS.premium
    );
  }
  if (tier === "multimodal") {
    return (
      process.env.AI_MODEL_MULTIMODAL?.trim() ||
      process.env.OPENROUTER_MULTIMODAL_MODEL?.trim() ||
      DEFAULT_OPENROUTER_MODELS.multimodal
    );
  }
  return (
    process.env.AI_MODEL_STANDARD?.trim() ||
    process.env.OPENROUTER_STANDARD_MODEL?.trim() ||
    DEFAULT_OPENROUTER_MODELS.standard
  );
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}
