import type { z } from "zod";
import type { ContextTaskType, ModelTier } from "@/lib/ai/models/types";

export type AIModelRole = ModelTier | "multimodal";

export type GenerateTextInput = {
  userId: string;
  taskType: ContextTaskType;
  role: AIModelRole;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  promptVersion: string;
  maxOutputTokens?: number;
  temperature?: number;
  modelName?: string;
  /** Skip paid call when a prior result with same hash exists */
  cacheKey?: string;
  preferPremium?: boolean;
};

export type StructuredGenerationInput<T> = GenerateTextInput & {
  schema: z.ZodType<T>;
  maxRetries?: number;
};

export type ImageAnalysisInput<T> = StructuredGenerationInput<T> & {
  imageUrl: string;
  requiresVision: true;
};

export type AITextResult = {
  text: string;
  provider: "openrouter";
  model: string;
  role: AIModelRole;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  actualCostUsd: number | null;
  latencyMs: number;
  cached: boolean;
  jobId: string | null;
  usedLlm: boolean;
};

export type StructuredAIResult<T> = AITextResult & {
  data: T;
  validationState: "valid" | "fallback" | "failed";
};

export type BudgetCheckResult =
  | { ok: true }
  | {
      ok: false;
      reason: "daily" | "monthly";
      spentUsd: number;
      budgetUsd: number;
      message: string;
    };

export interface AIProvider {
  generateText(input: GenerateTextInput): Promise<AITextResult>;
  generateStructured<T>(
    input: StructuredGenerationInput<T>,
  ): Promise<StructuredAIResult<T>>;
  analyzeImage?<T>(
    input: ImageAnalysisInput<T>,
  ): Promise<StructuredAIResult<T>>;
}
