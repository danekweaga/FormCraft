import {
  normalizeTranscriptText,
  type TranscriptResult,
  type TranscriptSegment,
} from "./types";

const SUPADATA_BASE_URL = "https://api.supadata.ai/v1";

export type SupadataPlatform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "x";

export type SupadataTranscriptResult = TranscriptResult & {
  platform: SupadataPlatform;
  billableRequests: number | null;
};

type SupadataTranscriptPayload = {
  jobId?: unknown;
  status?: unknown;
  content?: unknown;
  lang?: unknown;
  error?: unknown;
  message?: unknown;
  details?: unknown;
};

type SupadataSegment = {
  text?: unknown;
  offset?: unknown;
  duration?: unknown;
};

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function identifySupadataPlatform(
  sourceUrl: string,
): SupadataPlatform | null {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (hostMatches(host, "youtube.com") || host === "youtu.be") {
      return "youtube";
    }
    if (hostMatches(host, "tiktok.com")) return "tiktok";
    if (hostMatches(host, "instagram.com")) return "instagram";
    if (hostMatches(host, "facebook.com") || host === "fb.watch") {
      return "facebook";
    }
    if (
      hostMatches(host, "x.com") ||
      hostMatches(host, "twitter.com")
    ) {
      return "x";
    }
    return null;
  } catch {
    return null;
  }
}

export function isSupadataConfigured(): boolean {
  return Boolean(process.env.SUPADATA_API_KEY?.trim());
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function payloadError(payload: SupadataTranscriptPayload): string | null {
  const direct =
    asString(payload.message) ??
    asString(payload.details) ??
    asString(payload.error);
  if (direct) return direct;
  if (payload.error && typeof payload.error === "object") {
    const error = payload.error as Record<string, unknown>;
    return (
      asString(error.message) ??
      asString(error.details) ??
      asString(error.error)
    );
  }
  return null;
}

function normalizePayload(
  payload: SupadataTranscriptPayload,
  platform: SupadataPlatform,
  billableRequests: number | null,
): SupadataTranscriptResult {
  const content = payload.content;
  let rawTranscript = "";
  let segments: TranscriptSegment[] = [];

  if (typeof content === "string") {
    rawTranscript = content.trim();
  } else if (Array.isArray(content)) {
    const providerSegments = content as SupadataSegment[];
    segments = providerSegments
      .map((segment) => {
        const text = asString(segment.text);
        if (!text) return null;
        const offsetMs = asNumber(segment.offset) ?? 0;
        const durationMs = asNumber(segment.duration) ?? 0;
        return {
          startSeconds: Math.max(0, offsetMs / 1000),
          endSeconds: Math.max(0, (offsetMs + durationMs) / 1000),
          text,
        };
      })
      .filter((segment): segment is TranscriptSegment => Boolean(segment));
    rawTranscript = segments.map((segment) => segment.text).join(" ").trim();
  }

  if (rawTranscript.length < 20) {
    throw new Error("Supadata returned an empty or too-short transcript.");
  }

  return {
    rawTranscript,
    normalizedTranscript: normalizeTranscriptText(rawTranscript),
    language: asString(payload.lang),
    confidence: null,
    provider: "supadata_auto",
    segments,
    platform,
    billableRequests,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function supadataRequest(
  url: URL,
  apiKey: string,
): Promise<{
  response: Response;
  payload: SupadataTranscriptPayload;
  billableRequests: number | null;
}> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "x-api-key": apiKey,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await response.json().catch(() => ({}))) as SupadataTranscriptPayload;
  const billableRequests = asNumber(
    response.headers.get("x-billable-requests"),
  );
  if (!response.ok && response.status !== 202) {
    const message =
      payloadError(payload) ?? `Supadata transcript failed (${response.status}).`;
    throw new Error(message);
  }
  return { response, payload, billableRequests };
}

export async function fetchSupadataTranscript(
  sourceUrl: string,
  options?: {
    pollIntervalMs?: number;
    maxPollMs?: number;
  },
): Promise<SupadataTranscriptResult> {
  const platform = identifySupadataPlatform(sourceUrl);
  if (!platform) {
    throw new Error(
      "Supadata only accepts public YouTube, TikTok, Instagram, Facebook, or X video URLs in FormCraft.",
    );
  }
  const apiKey = process.env.SUPADATA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("SUPADATA_API_KEY is not configured.");
  }

  const transcriptUrl = new URL(`${SUPADATA_BASE_URL}/transcript`);
  transcriptUrl.searchParams.set("url", sourceUrl);
  transcriptUrl.searchParams.set("mode", "auto");
  transcriptUrl.searchParams.set("text", "false");

  const initial = await supadataRequest(transcriptUrl, apiKey);
  const jobId = asString(initial.payload.jobId);
  if (!jobId) {
    return normalizePayload(
      initial.payload,
      platform,
      initial.billableRequests,
    );
  }

  const pollIntervalMs = Math.max(0, options?.pollIntervalMs ?? 1_000);
  const maxPollMs = Math.max(1_000, options?.maxPollMs ?? 50_000);
  const deadline = Date.now() + maxPollMs;
  const jobUrl = new URL(
    `${SUPADATA_BASE_URL}/transcript/${encodeURIComponent(jobId)}`,
  );
  while (Date.now() < deadline) {
    if (pollIntervalMs > 0) await sleep(pollIntervalMs);
    const job = await supadataRequest(jobUrl, apiKey);
    const status = asString(job.payload.status);
    if (status === "completed") {
      return normalizePayload(
        job.payload,
        platform,
        initial.billableRequests,
      );
    }
    if (status === "failed") {
      throw new Error(payloadError(job.payload) ?? "Supadata transcript job failed.");
    }
  }

  throw new Error(
    "Supadata started the transcript but it did not finish within 50 seconds. Retry shortly; the provider keeps completed jobs for one hour.",
  );
}
