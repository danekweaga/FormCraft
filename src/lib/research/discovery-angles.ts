import { compactDiscoveryQuery } from "./search-filters";

const TECH_LANES = [
  "AI model release",
  "tech news",
  "AI startup",
  "AI development",
  "ChatGPT Claude Gemini",
  "OpenAI Anthropic",
  "machine learning news",
  "startup funding AI",
];

function uniqueQueries(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const query = compactDiscoveryQuery(value, 4);
    if (!query || seen.has(query)) continue;
    seen.add(query);
    out.push(query);
  }
  return out;
}

function looksLikeTechNiche(text: string): boolean {
  return /\b(ai|tech|startup|software|coding|cs|computer|ml|llm|model|dev|openai|claude|gemini)\b/.test(
    text.toLowerCase(),
  );
}

/**
 * Short search lanes for For You. One concatenated niche sentence keeps
 * returning the same accounts; rotating angles finds new creators.
 */
export function buildDiscoveryAngles(params: {
  niche: string | null;
  keywords?: string[] | null;
  topics?: string[] | null;
}): string[] {
  const niche = params.niche?.trim() || "";
  const extras = [...(params.keywords ?? []), ...(params.topics ?? [])]
    .map((value) => value.trim())
    .filter(Boolean);
  const angles = uniqueQueries([niche, ...extras.slice(0, 6)]);
  const haystack = `${niche} ${extras.join(" ")}`;
  if (!niche || looksLikeTechNiche(haystack)) {
    angles.push(...uniqueQueries(TECH_LANES));
  }
  return uniqueQueries(angles).slice(0, 8);
}

export function nextDiscoveryQueryBatch(
  queries: string[],
  cursor = 0,
  batchSize = 2,
): { batch: string[]; nextCursor: number } {
  const unique = uniqueQueries(queries);
  if (unique.length === 0) return { batch: [], nextCursor: 0 };
  const size = Math.min(Math.max(1, batchSize), unique.length);
  const start = ((cursor % unique.length) + unique.length) % unique.length;
  const batch = Array.from(
    { length: size },
    (_, index) => unique[(start + index) % unique.length]!,
  );
  return { batch, nextCursor: (start + size) % unique.length };
}
