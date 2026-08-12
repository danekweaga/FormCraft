import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeOpenAlexWork,
  openAlexProvider,
  reconstructOpenAlexAbstract,
} from "./openalex";

describe("OpenAlex psychology provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reconstructs abstracts from an inverted index", () => {
    expect(
      reconstructOpenAlexAbstract({ Curiosity: [0], drives: [1], attention: [2] }),
    ).toBe("Curiosity drives attention");
  });

  it("normalizes provenance, authors, study type, and access", () => {
    expect(
      normalizeOpenAlexWork({
        id: "https://openalex.org/W123",
        doi: "https://doi.org/10.1000/test",
        display_name: "A systematic review of curiosity",
        publication_year: 2025,
        type: "review",
        cited_by_count: 20,
        authorships: [{ author: { display_name: "Ada Researcher" } }],
        primary_location: { source: { display_name: "Journal of Evidence" } },
        best_oa_location: { pdf_url: "https://example.test/paper.pdf" },
      }),
    ).toMatchObject({
      providerId: "W123",
      doi: "10.1000/test",
      authors: ["Ada Researcher"],
      studyType: "systematic_review",
      fullTextAccess: "open",
    });
  });

  it("uses the official search parameter and keeps the key server-side", async () => {
    vi.stubEnv("OPENALEX_API_KEY", "test-openalex-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: "https://openalex.org/W123",
              display_name: "Information gaps and curiosity",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await openAlexProvider.searchStudies("curiosity gap", 10);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin).toBe("https://api.openalex.org");
    expect(url.searchParams.get("search")).toBe("curiosity gap");
    expect(url.searchParams.get("api_key")).toBe("test-openalex-key");
    expect(results[0]?.providerId).toBe("W123");
  });
});
