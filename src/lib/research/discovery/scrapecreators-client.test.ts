import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchScrapeCreatorsCreditBalance,
  getScrapeCreatorsUsage,
  resetScrapeCreatorsUsage,
  scrapeCreatorsCreditWarning,
  ScrapeCreatorsCreditsError,
  scrapecreatorsGet,
} from "./scrapecreators-client";

describe("scrapecreators client", () => {
  afterEach(() => {
    resetScrapeCreatorsUsage();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends x-api-key and records remaining credits", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "test-sc-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          credits_remaining: 7099,
          credits_charged: 1,
          search_item_list: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await scrapecreatorsGet("/v1/tiktok/search/keyword", { query: "coding" });

    const [requestUrl, init] = fetchMock.mock.calls[0]!;
    const url = new URL(String(requestUrl));
    expect(url.pathname).toBe("/v1/tiktok/search/keyword");
    expect(url.searchParams.get("query")).toBe("coding");
    expect(init?.headers).toEqual({ "x-api-key": "test-sc-key" });
    expect(getScrapeCreatorsUsage()).toMatchObject({
      creditsRemaining: 7099,
      creditsChargedThisSession: 1,
      exhausted: false,
    });
  });

  it("throws a credits-finished error on 402", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "test-sc-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ credits_remaining: 0 }), {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      scrapecreatorsGet("/v1/tiktok/search/keyword", { query: "x" }),
    ).rejects.toBeInstanceOf(ScrapeCreatorsCreditsError);
    expect(getScrapeCreatorsUsage().exhausted).toBe(true);
    expect(getScrapeCreatorsUsage().creditsRemaining).toBe(0);
  });

  it("reads credit balance from the documented account endpoint", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "test-sc-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ credits_remaining: 7100 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchScrapeCreatorsCreditBalance();
    expect(new URL(String(fetchMock.mock.calls[0]![0])).pathname).toBe(
      "/v1/account/credit-balance",
    );
    expect(result).toEqual({
      creditsRemaining: 7100,
      exhausted: false,
      error: null,
    });
  });

  it("parses creditCount from the documented response", async () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "test-sc-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ creditCount: 42 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(fetchScrapeCreatorsCreditBalance()).resolves.toMatchObject({
      creditsRemaining: 42,
      exhausted: false,
    });
  });

  it("warns when credits are low or finished", () => {
    expect(scrapeCreatorsCreditWarning(0, true)).toMatch(/finished/i);
    expect(scrapeCreatorsCreditWarning(10, false)).toMatch(/10 credit/);
    expect(scrapeCreatorsCreditWarning(500, false)).toBeNull();
  });
});
