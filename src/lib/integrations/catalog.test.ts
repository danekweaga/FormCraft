import { afterEach, describe, expect, it, vi } from "vitest";
import { listAppIntegrations } from "./catalog";

describe("integrations catalog", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("marks ScrapeCreators connected when the key is set", () => {
    vi.stubEnv("SCRAPECREATORS_API_KEY", "sc-key");
    vi.stubEnv("YOUTUBE_DATA_API_KEY", "yt-key");
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

    const items = listAppIntegrations();
    const scrape = items.find((i) => i.id === "scrapecreators");
    expect(scrape?.status).toBe("connected");
    expect(scrape?.envVars).toContain("SCRAPECREATORS_API_KEY");
    expect(items.some((i) => i.id === "openrouter")).toBe(true);
    expect(items.some((i) => i.id === "youtube-data")).toBe(true);
  });
});
