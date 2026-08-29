import { AsyncLocalStorage } from "node:async_hooks";

const BASE = "https://api.scrapecreators.com";

export const SCRAPECREATORS_LOW_CREDIT_THRESHOLD = 25;
export const SCRAPECREATORS_CREDITS_URL = "https://app.scrapecreators.com/";

export class ScrapeCreatorsCreditsError extends Error {
  readonly code = "SCRAPECREATORS_CREDITS_EXHAUSTED";
  constructor() {
    super(
      "ScrapeCreators credits are finished. Buy more at https://app.scrapecreators.com/",
    );
    this.name = "ScrapeCreatorsCreditsError";
  }
}

export type ScrapeCreatorsUsage = {
  creditsRemaining: number | null;
  creditsChargedThisSession: number;
  exhausted: boolean;
  lastPath: string | null;
};

let usage: ScrapeCreatorsUsage = emptyUsage();
const scopedUsage = new AsyncLocalStorage<{ creditsCharged: number }>();

function emptyUsage(): ScrapeCreatorsUsage {
  return {
    creditsRemaining: null,
    creditsChargedThisSession: 0,
    exhausted: false,
    lastPath: null,
  };
}

export function isScrapeCreatorsConfigured(): boolean {
  return Boolean(process.env.SCRAPECREATORS_API_KEY?.trim());
}

export function resetScrapeCreatorsUsage(): void {
  usage = emptyUsage();
}

export function getScrapeCreatorsUsage(): ScrapeCreatorsUsage {
  return { ...usage };
}

export async function captureScrapeCreatorsUsage<T>(
  task: () => Promise<T>,
): Promise<{ value: T; creditsCharged: number }> {
  const scope = { creditsCharged: 0 };
  try {
    const value = await scopedUsage.run(scope, task);
    return { value, creditsCharged: scope.creditsCharged };
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    Object.assign(cause, {
      scrapeCreatorsCreditsCharged: scope.creditsCharged,
    });
    throw cause;
  }
}

export function scrapeCreatorsCreditsChargedFromError(error: unknown): number {
  if (!error || typeof error !== "object") return 0;
  const value = Number(
    (error as { scrapeCreatorsCreditsCharged?: unknown })
      .scrapeCreatorsCreditsCharged,
  );
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function apiKey(): string {
  const key = process.env.SCRAPECREATORS_API_KEY?.trim();
  if (!key) throw new Error("SCRAPECREATORS_API_KEY is not configured.");
  return key;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function rememberCredits(params: {
  remaining: number | null;
  charged: number;
  path: string;
  exhausted: boolean;
}) {
  if (params.remaining != null) usage.creditsRemaining = params.remaining;
  usage.creditsChargedThisSession += Math.max(0, params.charged);
  const scope = scopedUsage.getStore();
  if (scope) scope.creditsCharged += Math.max(0, params.charged);
  usage.lastPath = params.path;
  if (params.exhausted) usage.exhausted = true;
}

export async function scrapecreatorsGet(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<Record<string, unknown>> {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { "x-api-key": apiKey() },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const remaining = asNumber(body.credits_remaining);
  const charged = asNumber(body.credits_charged) ?? 0;
  rememberCredits({
    remaining,
    charged,
    path,
    exhausted: response.status === 402,
  });

  if (response.status === 402) {
    throw new ScrapeCreatorsCreditsError();
  }
  if (!response.ok) {
    const message =
      asString(body.message) ??
      asString(body.error) ??
      `ScrapeCreators failed (${response.status})`;
    console.error("[scrapecreators] request failed", {
      path,
      status: response.status,
      message,
    });
    throw new Error(message);
  }
  return body;
}

/**
 * Live credit remaining. ScrapeCreators charges one credit for this request,
 * so callers must only invoke it after an explicit user action.
 */
export async function fetchScrapeCreatorsCreditBalance(): Promise<{
  creditsRemaining: number | null;
  exhausted: boolean;
  error: string | null;
}> {
  if (!isScrapeCreatorsConfigured()) {
    return { creditsRemaining: null, exhausted: false, error: "not_configured" };
  }

  try {
    const body = await scrapecreatorsGet("/v1/account/credit-balance");
    const nested = pickRecord(body.data);
    const remaining =
      asNumber(body.creditCount) ??
      asNumber(body.credits_remaining) ??
      asNumber(nested?.creditCount) ??
      asNumber(nested?.credits_remaining);
    return {
      creditsRemaining: remaining,
      exhausted: remaining === 0,
      error: remaining == null ? "balance_unavailable" : null,
    };
  } catch (error) {
    if (error instanceof ScrapeCreatorsCreditsError) {
      return { creditsRemaining: 0, exhausted: true, error: null };
    }
    return {
      creditsRemaining: usage.creditsRemaining,
      exhausted: usage.exhausted,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function scrapeCreatorsCreditWarning(
  remaining: number | null,
  exhausted = false,
): string | null {
  if (exhausted || remaining === 0) {
    return "ScrapeCreators credits are finished. TikTok and Instagram pulls will stop until you buy more at app.scrapecreators.com.";
  }
  if (remaining != null && remaining <= SCRAPECREATORS_LOW_CREDIT_THRESHOLD) {
    return `ScrapeCreators is low: ${remaining} credit${remaining === 1 ? "" : "s"} left (1 request = 1 credit).`;
  }
  return null;
}
