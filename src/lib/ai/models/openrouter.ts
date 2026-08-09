import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { estimateMessagesTokens, estimateTokens } from "./estimate-tokens";
import { isLlmConfigured, resolveModelName } from "./router";
import type { LlmMessage, LlmResult, ModelTier } from "./types";

/**
 * OpenRouter chat completion. Returns null when not configured —
 * callers must fall back to deterministic heuristics.
 * Never logs message contents that may contain secrets.
 */
export async function callOpenRouter(params: {
  tier: ModelTier;
  modelName?: string;
  messages: LlmMessage[];
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<LlmResult | null> {
  if (!isLlmConfigured()) return null;

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  const modelName = params.modelName ?? resolveModelName(params.tier);
  const estimatedInputTokens = estimateMessagesTokens(params.messages);
  const provider = createOpenRouter({
    apiKey,
    headers: {
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "FormCraft",
    },
  });

  const timeoutMs = Number(process.env.AI_DEFAULT_TIMEOUT_MS ?? "45000");
  const abortSignal =
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

  try {
    const result = await generateText({
      model: provider(modelName, { usage: { include: true } }),
      messages: params.messages,
      maxOutputTokens: params.maxOutputTokens ?? 1200,
      temperature: params.temperature ?? 0.2,
      ...(abortSignal ? { abortSignal } : {}),
    });
    const usage = result.providerMetadata?.openrouter?.usage as
      | { cost?: number }
      | undefined;
    return {
      text: result.text.trim(),
      modelName,
      modelTier: params.tier,
      estimatedInputTokens:
        result.usage.inputTokens ?? estimatedInputTokens,
      estimatedOutputTokens:
        result.usage.outputTokens ?? estimateTokens(result.text),
      actualCostUsd: typeof usage?.cost === "number" ? usage.cost : null,
      usedLlm: true,
    };
  } catch (error) {
    const status =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : null;
    throw new Error(
      `OpenRouter request failed${status ? ` (${status})` : ""}. Check the API key, selected model, and credit balance.`,
    );
  }
}
