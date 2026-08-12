import type {
  ScholarlySearchProvider,
  ScholarlyStudy,
  ScholarlyStudyType,
} from "./types";

const OPENALEX_BASE = "https://api.openalex.org";

type OpenAlexWork = {
  id?: unknown;
  doi?: unknown;
  display_name?: unknown;
  title?: unknown;
  publication_year?: unknown;
  type?: unknown;
  cited_by_count?: unknown;
  is_retracted?: unknown;
  abstract_inverted_index?: unknown;
  authorships?: unknown;
  primary_location?: unknown;
  best_oa_location?: unknown;
};

function apiKey(): string {
  const key = process.env.OPENALEX_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "OPENALEX_API_KEY is not configured. Create a free key at openalex.org/settings/api.",
    );
  }
  return key;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function reconstructOpenAlexAbstract(value: unknown): string | null {
  const index = asRecord(value);
  if (!index) return null;
  const words: Array<{ word: string; position: number }> = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      if (typeof position === "number" && Number.isFinite(position)) {
        words.push({ word, position });
      }
    }
  }
  if (words.length === 0) return null;
  return words
    .sort((a, b) => a.position - b.position)
    .map((entry) => entry.word)
    .join(" ");
}

function normalizeDoi(value: unknown): string | null {
  const doi = asString(value);
  return doi?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "") ?? null;
}

function inferStudyType(value: unknown, title: string): ScholarlyStudyType {
  const combined = `${asString(value) ?? ""} ${title}`.toLowerCase();
  if (/meta[- ]analysis/.test(combined)) return "meta_analysis";
  if (/systematic review/.test(combined)) return "systematic_review";
  if (/replicat/.test(combined)) return "replication";
  if (/randomi[sz]ed|experiment/.test(combined)) return "experiment";
  if (/observational|cohort|cross-sectional/.test(combined)) {
    return "observational";
  }
  if (/review/.test(combined)) return "review";
  return "other";
}

function locationDetails(value: unknown) {
  const location = asRecord(value);
  const source = asRecord(location?.source);
  return {
    landingPageUrl: asString(location?.landing_page_url),
    pdfUrl: asString(location?.pdf_url),
    journal: asString(source?.display_name),
  };
}

export function normalizeOpenAlexWork(work: OpenAlexWork): ScholarlyStudy | null {
  const providerUrl = asString(work.id);
  const providerId = providerUrl?.split("/").pop() ?? null;
  const title = asString(work.display_name) ?? asString(work.title);
  if (!providerId || !title) return null;

  const primary = locationDetails(work.primary_location);
  const open = locationDetails(work.best_oa_location);
  const doi = normalizeDoi(work.doi);
  const authors = Array.isArray(work.authorships)
    ? work.authorships
        .map((entry) => asString(asRecord(asRecord(entry)?.author)?.display_name))
        .filter((name): name is string => Boolean(name))
    : [];
  const openAccessUrl = open.pdfUrl ?? open.landingPageUrl;
  const sourceUrl =
    (doi ? `https://doi.org/${doi}` : null) ??
    primary.landingPageUrl ??
    openAccessUrl ??
    providerUrl ??
    `${OPENALEX_BASE}/works/${providerId}`;

  return {
    provider: "openalex",
    providerId,
    doi,
    title,
    authors,
    year: asNumber(work.publication_year),
    journal: primary.journal ?? open.journal,
    studyType: inferStudyType(work.type, title),
    abstract: reconstructOpenAlexAbstract(work.abstract_inverted_index),
    citedByCount: asNumber(work.cited_by_count) ?? 0,
    isRetracted: work.is_retracted === true,
    fullTextAccess: openAccessUrl ? "open" : "metadata_only",
    sourceUrl,
    openAccessUrl,
  };
}

async function openAlexGet(
  path: string,
  params: Record<string, string>,
): Promise<unknown> {
  const url = new URL(path, OPENALEX_BASE);
  url.searchParams.set("api_key", apiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`OpenAlex request failed (${response.status}).`);
  }
  return response.json();
}

const SELECT_FIELDS = [
  "id",
  "doi",
  "display_name",
  "publication_year",
  "type",
  "cited_by_count",
  "is_retracted",
  "abstract_inverted_index",
  "authorships",
  "primary_location",
  "best_oa_location",
].join(",");

export const openAlexProvider: ScholarlySearchProvider = {
  providerName: "openalex",

  isConfigured() {
    return Boolean(process.env.OPENALEX_API_KEY?.trim());
  },

  async searchStudies(query, limit = 12) {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 3) return [];
    const body = asRecord(
      await openAlexGet("/works", {
        search: normalizedQuery,
        per_page: String(Math.min(25, Math.max(1, limit))),
        sort: "relevance_score:desc",
        select: SELECT_FIELDS,
      }),
    );
    const results = Array.isArray(body?.results) ? body.results : [];
    return results
      .map((work) => normalizeOpenAlexWork(work as OpenAlexWork))
      .filter((work): work is ScholarlyStudy => Boolean(work));
  },

  async getStudy(providerId) {
    if (!/^W\d+$/.test(providerId)) {
      throw new Error("Invalid OpenAlex work ID.");
    }
    const work = normalizeOpenAlexWork(
      (await openAlexGet(`/works/${providerId}`, {
        select: SELECT_FIELDS,
      })) as OpenAlexWork,
    );
    if (!work) throw new Error("OpenAlex returned an unusable study record.");
    return work;
  },
};
