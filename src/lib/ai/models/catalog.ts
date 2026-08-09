export type OpenRouterModel = {
  id: string;
  name: string;
  contextLength: number | null;
  promptPricePerMillion: number | null;
  completionPricePerMillion: number | null;
  supportsStructuredOutput: boolean;
};

type OpenRouterModelResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    context_length?: number;
    pricing?: { prompt?: string; completion?: string };
    supported_parameters?: string[];
    architecture?: {
      input_modalities?: string[];
      output_modalities?: string[];
    };
  }>;
};

function perMillion(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 1_000_000 : null;
}

export async function getOpenRouterModels(): Promise<OpenRouterModel[]> {
  try {
    const headers: Record<string, string> = {};
    if (process.env.OPENROUTER_API_KEY?.trim()) {
      headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY.trim()}`;
    }
    const response = await fetch(
      "https://openrouter.ai/api/v1/models?output_modalities=text&sort=most-popular",
      { headers, next: { revalidate: 60 * 60 } },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as OpenRouterModelResponse;
    return (payload.data ?? []).flatMap((model) => {
      const textInput = model.architecture?.input_modalities?.includes("text");
      const textOutput = model.architecture?.output_modalities?.includes("text");
      if (!model.id || !textInput || !textOutput) return [];
      return [
        {
          id: model.id,
          name: model.name ?? model.id,
          contextLength:
            typeof model.context_length === "number"
              ? model.context_length
              : null,
          promptPricePerMillion: perMillion(model.pricing?.prompt),
          completionPricePerMillion: perMillion(model.pricing?.completion),
          supportsStructuredOutput:
            model.supported_parameters?.includes("response_format") ?? false,
        },
      ];
    });
  } catch {
    return [];
  }
}

