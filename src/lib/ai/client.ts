import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import {
  CONTENT_INTELLIGENCE_VERSION,
  contentIntelligencePromptBlock,
} from "@/lib/content-intelligence/kernel";
import type { ContextTaskType } from "@/lib/ai/models/types";
import { callOpenRouter } from "@/lib/ai/models/openrouter";
import { isLlmConfigured } from "@/lib/ai/models/router";
import { resolveTaskModel } from "@/lib/ai/models/preferences";
import { AiBudgetError, checkAiBudget } from "./budget";
import { hashAiInput, readAiCache, writeAiCache } from "./cache";
import { resolveModelNameForRole, roleToLegacyTier } from "./router";
import type {
  AIProvider,
  AITextResult,
  GenerateTextInput,
  ImageAnalysisInput,
  StructuredAIResult,
  StructuredGenerationInput,
} from "./types";

function maxRetries(): number {
  const n = Number(process.env.AI_MAX_RETRIES ?? "2");
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 2;
}

export function withContentIntelligence(
  taskType: ContextTaskType,
  messages: GenerateTextInput["messages"],
): GenerateTextInput["messages"] {
  return [
    {
      role: "system",
      content: contentIntelligencePromptBlock(taskType),
    },
    ...messages,
  ];
}

async function createJob(
  supabase: SupabaseClient,
  input: {
    userId: string;
    jobType: string;
    model: string;
    promptVersion: string;
    inputHash?: string;
  },
) {
  const { data } = await supabase
    .from("ai_jobs")
    .insert({
      user_id: input.userId,
      job_type: input.jobType,
      provider: "openrouter",
      model: input.model,
      status: "processing",
      prompt_version: input.promptVersion,
      started_at: new Date().toISOString(),
      input_hash: input.inputHash ?? null,
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

async function finishJob(
  supabase: SupabaseClient,
  jobId: string | null,
  patch: Record<string, unknown>,
) {
  if (!jobId) return;
  await supabase
    .from("ai_jobs")
    .update({
      ...patch,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

async function recordUsage(
  supabase: SupabaseClient,
  input: {
    userId: string;
    taskType: string;
    role: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("ai_usage_events").insert({
    user_id: input.userId,
    provider: "openrouter",
    task_type: input.taskType,
    model_tier: input.role === "multimodal" ? "multimodal" : input.role,
    model_name: input.model,
    estimated_input_tokens: input.inputTokens,
    estimated_output_tokens: input.outputTokens,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    estimated_cost_usd: input.costUsd ?? 0,
    cost_usd: input.costUsd,
    metadata: input.metadata ?? {},
  });
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in model response");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export function createFormCraftAI(supabase: SupabaseClient): AIProvider {
  return {
    async generateText(input: GenerateTextInput): Promise<AITextResult> {
      const started = Date.now();
      const messages = withContentIntelligence(input.taskType, input.messages);
      const modelSelection = await resolveTaskModel(supabase, {
        userId: input.userId,
        taskType: input.taskType,
        preferPremium: input.preferPremium || input.role === "premium",
      });
      const model =
        input.modelName ??
        (input.role === "multimodal"
          ? resolveModelNameForRole("multimodal")
          : modelSelection.modelName);

      const baseCacheKey =
        input.cacheKey ??
        hashAiInput([
          input.taskType,
          input.promptVersion,
          model,
          messages,
        ]);
      const cacheKey = `${baseCacheKey}:${CONTENT_INTELLIGENCE_VERSION}`;

      const cached = await readAiCache<{
        text: string;
        inputTokens: number;
        outputTokens: number;
        costUsd: number | null;
      }>({
        supabase,
        userId: input.userId,
        cacheKey,
      });
      if (cached) {
        const jobId = await createJob(supabase, {
          userId: input.userId,
          jobType: input.taskType,
          model,
          promptVersion: input.promptVersion,
          inputHash: cacheKey,
        });
        await finishJob(supabase, jobId, {
          status: "completed",
          cached: true,
          input_tokens: cached.inputTokens,
          output_tokens: cached.outputTokens,
          actual_cost: 0,
        });
        return {
          text: cached.text,
          provider: "openrouter",
          model,
          role: input.role,
          inputTokens: cached.inputTokens,
          outputTokens: cached.outputTokens,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          latencyMs: Date.now() - started,
          cached: true,
          jobId,
          usedLlm: true,
        };
      }

      if (!isLlmConfigured()) {
        throw new Error(
          "AI analysis unavailable. OPENROUTER_API_KEY is not configured.",
        );
      }

      const budget = await checkAiBudget(supabase, input.userId);
      if (!budget.ok) {
        const jobId = await createJob(supabase, {
          userId: input.userId,
          jobType: input.taskType,
          model,
          promptVersion: input.promptVersion,
          inputHash: cacheKey,
        });
        await finishJob(supabase, jobId, {
          status: "budget_blocked",
          error_code: budget.reason,
          error_message: budget.message,
        });
        throw new AiBudgetError(budget);
      }

      const jobId = await createJob(supabase, {
        userId: input.userId,
        jobType: input.taskType,
        model,
        promptVersion: input.promptVersion,
        inputHash: cacheKey,
      });

      try {
        const result = await callOpenRouter({
          tier: roleToLegacyTier(input.role),
          modelName: model,
          messages,
          maxOutputTokens: input.maxOutputTokens,
          temperature: input.temperature,
        });
        if (!result) {
          throw new Error(
            "AI analysis unavailable. OPENROUTER_API_KEY is not configured in this environment.",
          );
        }

        await writeAiCache({
          supabase,
          userId: input.userId,
          cacheKey,
          jobType: input.taskType,
          promptVersion: input.promptVersion,
          model,
          result: {
            text: result.text,
            inputTokens: result.estimatedInputTokens,
            outputTokens: result.estimatedOutputTokens,
            costUsd: result.actualCostUsd,
          },
        });

        await finishJob(supabase, jobId, {
          status: "completed",
          input_tokens: result.estimatedInputTokens,
          output_tokens: result.estimatedOutputTokens,
          actual_cost: result.actualCostUsd,
          estimated_cost: result.actualCostUsd ?? 0,
        });
        await recordUsage(supabase, {
          userId: input.userId,
          taskType: input.taskType,
          role: input.role,
          model,
          inputTokens: result.estimatedInputTokens,
          outputTokens: result.estimatedOutputTokens,
          costUsd: result.actualCostUsd,
          metadata: { promptVersion: input.promptVersion, cached: false },
        });

        return {
          text: result.text,
          provider: "openrouter",
          model,
          role: input.role,
          inputTokens: result.estimatedInputTokens,
          outputTokens: result.estimatedOutputTokens,
          estimatedCostUsd: result.actualCostUsd,
          actualCostUsd: result.actualCostUsd,
          latencyMs: Date.now() - started,
          cached: false,
          jobId,
          usedLlm: true,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "OpenRouter request failed";
        await finishJob(supabase, jobId, {
          status: message.toLowerCase().includes("429")
            ? "rate_limited"
            : "failed",
          error_message: message.slice(0, 500),
        });
        throw error;
      }
    },

    async generateStructured<T>(
      input: StructuredGenerationInput<T>,
    ): Promise<StructuredAIResult<T>> {
      const retries = input.maxRetries ?? maxRetries();
      let lastText = "";
      let lastResult: AITextResult | null = null;
      let lastError: unknown;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const repair =
            attempt === 0
              ? ""
              : "\n\nPrevious response was invalid JSON. Return ONLY valid JSON matching the schema.";
          lastResult = await this.generateText({
            ...input,
            cacheKey:
              attempt === 0
                ? input.cacheKey
                : `${input.cacheKey ?? "structured"}:retry:${attempt}`,
            messages: [
              ...input.messages,
              ...(repair
                ? ([
                    {
                      role: "user" as const,
                      content: repair,
                    },
                  ] as const)
                : []),
            ],
          });
          lastText = lastResult.text;
          const parsed = input.schema.parse(extractJsonObject(lastText));
          return {
            ...lastResult,
            data: parsed,
            validationState: "valid",
          };
        } catch (error) {
          lastError = error;
          if (error instanceof AiBudgetError) throw error;
        }
      }

      throw new Error(
        lastError instanceof Error
          ? `Structured AI validation failed: ${lastError.message}`
          : "Structured AI validation failed after retries.",
      );
    },

    async analyzeImage<T>(
      input: ImageAnalysisInput<T>,
    ): Promise<StructuredAIResult<T>> {
      // OpenRouter vision via text+image URL in user content
      return this.generateStructured({
        ...input,
        role: "multimodal",
        messages: [
          ...input.messages,
          {
            role: "user",
            content: `Image URL for analysis (use only if accessible): ${input.imageUrl}`,
          },
        ],
      });
    },
  };
}

/** Helper for callers that want soft-fail + heuristic fallback. */
export async function tryStructuredAI<T>(params: {
  supabase: SupabaseClient;
  input: StructuredGenerationInput<T>;
  fallback: T;
}): Promise<StructuredAIResult<T>> {
  try {
    return await createFormCraftAI(params.supabase).generateStructured(
      params.input,
    );
  } catch (error) {
    const fallbackReason =
      error instanceof Error ? error.message : "AI generation failed.";
    console.error("[ai:fallback] structured generation unavailable", {
      taskType: params.input.taskType,
      role: params.input.role,
      modelName: params.input.modelName ?? null,
      reason: fallbackReason,
    });
    if (error instanceof AiBudgetError) {
      return {
        text: "",
        provider: "openrouter",
        model: "none",
        role: params.input.role,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        latencyMs: 0,
        cached: false,
        jobId: null,
        usedLlm: false,
        data: params.fallback,
        validationState: "fallback",
        fallbackReason,
      };
    }
    return {
      text: "",
      provider: "openrouter",
      model: "none",
      role: params.input.role,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      latencyMs: 0,
      cached: false,
      jobId: null,
      usedLlm: false,
      data: params.fallback,
      validationState: "fallback",
      fallbackReason,
    };
  }
}

// Re-export hash for classification/analysis callers
export { hashAiInput };
export type { z };
