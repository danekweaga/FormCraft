import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { estimateMessagesTokens, estimateTokens } from "./estimate-tokens";
import { isLlmConfigured, resolveModelName } from "./router";
import type { LlmMessage, LlmResult, ModelTier } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function errorStatus(error: unknown): number | null {
  const record = asRecord(error);
  const cause = asRecord(record?.cause);
  for (const value of [
    record?.statusCode,
    record?.status,
    cause?.statusCode,
    cause?.status,
  ]) {
    const status = Number(value);
    if (Number.isInteger(status) && status >= 100 && status <= 599) {
      return status;
    }
  }
  return null;
}

function safeProviderMessage(error: unknown, apiKey: string): string | null {
  const record = asRecord(error);
  const cause = asRecord(record?.cause);
  let responseBody: unknown = record?.responseBody ?? cause?.responseBody;
  if (typeof responseBody === "string") {
    try {
      responseBody = JSON.parse(responseBody);
    } catch {
      // A non-JSON response is still useful diagnostic text.
    }
  }
  const body = asRecord(responseBody);
  const bodyError = asRecord(body?.error);
  const candidates = [
    bodyError?.message,
    body?.message,
    cause?.message,
    record?.message,
  ];
  const message = candidates.find(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
  if (!message) return null;
  return message.replaceAll(apiKey, "[redacted]").replace(/\s+/g, " ").slice(0, 300);
}

function openRouterErrorMessage(error: unknown, apiKey: string): string {
  const status = errorStatus(error);
  const providerMessage = safeProviderMessage(error, apiKey);
  if (status === 401 || status === 403) {
    return `OpenRouter rejected the server API key (${status}). Update OPENROUTER_API_KEY in this environment and redeploy.`;
  }
  if (status === 402) {
    return "OpenRouter credits or the key spending limit are exhausted (402). Add credits or raise the key limit.";
  }
  if (status === 404) {
    return `OpenRouter could not find the selected model (404)${providerMessage ? `: ${providerMessage}` : "."}`;
  }
  if (status === 429) {
    return `OpenRouter rate limit reached (429)${providerMessage ? `: ${providerMessage}` : ". Try again shortly."}`;
  }
  return `OpenRouter request failed${status ? ` (${status})` : ""}${providerMessage ? `: ${providerMessage}` : "."}`;
}

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
      "X-OpenRouter-Title": "FormCraft",
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
    throw new Error(openRouterErrorMessage(error, apiKey));
  }
}
