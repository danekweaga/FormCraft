import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateTextMock = vi.hoisted(() => vi.fn());
const modelFactoryMock = vi.hoisted(() => vi.fn(() => ({ modelId: "mock" })));
const createOpenRouterMock = vi.hoisted(() =>
  vi.fn(() => modelFactoryMock),
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
    modelFactoryMock.mockClear();
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

    expect(modelFactoryMock).toHaveBeenCalledWith(
      "anthropic/claude-sonnet-5",
      { usage: { include: true } },
    );
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
