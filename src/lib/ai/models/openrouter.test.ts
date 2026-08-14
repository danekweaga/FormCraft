import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateTextMock = vi.hoisted(() => vi.fn());
const chatMock = vi.hoisted(() => vi.fn(() => ({ modelId: "mock" })));
const createOpenRouterMock = vi.hoisted(() =>
  vi.fn(() => {
    const provider = Object.assign(vi.fn(), { chat: chatMock });
    return provider;
  }),
);

vi.mock("ai", () => ({ generateText: generateTextMock }));
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: createOpenRouterMock,
}));

import { callOpenRouter } from "./openrouter";

describe("OpenRouter AI SDK adapter", () => {
  const previousKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key-never-sent";
    chatMock.mockClear();
    createOpenRouterMock.mockClear();
    generateTextMock.mockReset();
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });

  it("uses the explicitly selected task model and returns usage", async () => {
    generateTextMock.mockResolvedValue({
      text: "FormCraft connected",
      usage: { inputTokens: 7, outputTokens: 2 },
      providerMetadata: { openrouter: { usage: { cost: 0.0001 } } },
    });

    const result = await callOpenRouter({
      tier: "standard",
      modelName: "anthropic/claude-sonnet-5",
      messages: [{ role: "user", content: "test" }],
    });

    expect(chatMock).toHaveBeenCalledWith("anthropic/claude-sonnet-5", {
      usage: { include: true },
    });
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "test" }],
      }),
    );
    expect(generateTextMock.mock.calls[0]?.[0]?.system).toBeUndefined();
    expect(result?.estimatedInputTokens).toBe(7);
    expect(result?.actualCostUsd).toBe(0.0001);
    expect(createOpenRouterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "test-key-never-sent",
        headers: expect.objectContaining({
          "X-OpenRouter-Title": "FormCraft",
        }),
      }),
    );
  });

  it("moves system prompts out of messages for Gemini-style models", async () => {
    generateTextMock.mockResolvedValue({
      text: "ok",
      usage: { inputTokens: 3, outputTokens: 1 },
    });

    await callOpenRouter({
      tier: "standard",
      modelName: "google/gemini-3.7-flash",
      messages: [
        { role: "system", content: "You are FormCraft." },
        { role: "user", content: "Hello" },
      ],
    });

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "You are FormCraft.",
        messages: [{ role: "user", content: "Hello" }],
      }),
    );
  });

  it("does not call a provider when the server key is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(
      await callOpenRouter({
        tier: "cheap",
        messages: [{ role: "user", content: "test" }],
      }),
    ).toBeNull();
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("reports an invalid server key instead of hiding the provider status", async () => {
    generateTextMock.mockRejectedValue({
      statusCode: 401,
      responseBody: JSON.stringify({
        error: { message: "User not found." },
      }),
    });

    await expect(
      callOpenRouter({
        tier: "standard",
        messages: [{ role: "user", content: "test" }],
      }),
    ).rejects.toThrow(
      "OpenRouter rejected the server API key (401). Update OPENROUTER_API_KEY in this environment and redeploy.",
    );
  });

  it("reports an unavailable selected model", async () => {
    generateTextMock.mockRejectedValue({
      statusCode: 404,
      responseBody: JSON.stringify({
        error: { message: "No endpoints found for this model." },
      }),
    });

    await expect(
      callOpenRouter({
        tier: "premium",
        modelName: "vendor/missing-model",
        messages: [{ role: "user", content: "test" }],
      }),
    ).rejects.toThrow(
      "OpenRouter could not find the selected model (404): No endpoints found for this model.",
    );
  });
});
