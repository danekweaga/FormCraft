/**
 * Fetch a public YouTube caption track as plain text when available.
 * Uses the watch-page captionTracks metadata first, then a documented no-key
 * transcript endpoint as a fallback when YouTube blocks the server request.
 */

type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string };
};

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
}

function timedTextXmlToPlain(xml: string): string {
  const texts = [...xml.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)].map(
    (m) =>
      decodeXmlEntities(m[1]!.replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim(),
  );
  return texts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) return null;
  const prefer = (pred: (t: CaptionTrack) => boolean) =>
    tracks.find(pred) ?? null;
  return (
    prefer((t) => t.languageCode === "en" && t.kind !== "asr") ||
    prefer((t) => (t.languageCode ?? "").startsWith("en") && t.kind !== "asr") ||
    prefer((t) => t.languageCode === "en") ||
    prefer((t) => (t.languageCode ?? "").startsWith("en")) ||
    prefer((t) => t.kind !== "asr") ||
    tracks[0]!
  );
}

function extractCaptionTracks(html: string): CaptionTrack[] {
  const marker = '"captionTracks":';
  const start = html.indexOf(marker);
  if (start < 0) return [];
  const fromArray = html.indexOf("[", start + marker.length);
  if (fromArray < 0) return [];
  let depth = 0;
  let end = -1;
  for (let i = fromArray; i < html.length; i++) {
    const ch = html[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) return [];
  try {
    const parsed = JSON.parse(html.slice(fromArray, end)) as CaptionTrack[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function freeTranscriptMarkdownToPlain(markdown: string): string {
  const marker = "## Transcript";
  const markerIndex = markdown.indexOf(marker);
  const transcript = markerIndex >= 0
    ? markdown.slice(markerIndex + marker.length)
    : markdown;

  return transcript
    .replace(/^#{1,6}\s+.*$/gm, " ")
    .replace(/^Source video:.*$/gim, " ")
    .replace(/^Language:.*$/gim, " ")
    .replace(/^Other available languages:.*$/gim, " ")
    .replace(/^To request a specific language:.*$/gim, " ")
    .replace(/^Interactive version.*$/gim, " ")
    .replace(/^\s*\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/gm, " ")
    .replace(/\[(?:music|applause|laughter|♪+)\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchDirectYouTubeCaptionTrack(
  id: string,
): Promise<string | null> {
  try {
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${id}`, {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (compatible; FormCraftResearch/1.0; +https://formcraft.app)",
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!watchRes.ok) return null;
    const html = await watchRes.text();
    const track = pickCaptionTrack(extractCaptionTracks(html));
    if (!track?.baseUrl) return null;

    const captionUrl = new URL(track.baseUrl);
    if (!captionUrl.searchParams.has("fmt")) {
      captionUrl.searchParams.set("fmt", "srv3");
    }

    const captionRes = await fetch(captionUrl.toString(), {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (compatible; FormCraftResearch/1.0; +https://formcraft.app)",
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!captionRes.ok) return null;
    const plain = timedTextXmlToPlain(await captionRes.text());
    return plain.length >= 40 ? plain.slice(0, 40_000) : null;
  } catch {
    return null;
  }
}

async function fetchFreeTranscriptFallback(
  id: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://youtube-transcript.ai/transcript/${encodeURIComponent(id)}.txt?lang=en`,
      {
        headers: {
          Accept: "text/plain",
          "User-Agent":
            "Mozilla/5.0 (compatible; FormCraftResearch/1.0; +https://form-craft-phi.vercel.app)",
        },
        next: { revalidate: 86_400 },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) return null;
    const body = await response.text();
    if (/<!doctype html|<html\b/i.test(body)) return null;
    const plain = freeTranscriptMarkdownToPlain(body);
    return plain.length >= 40 ? plain.slice(0, 40_000) : null;
  } catch {
    return null;
  }
}

export async function fetchYouTubeTranscript(
  videoId: string,
): Promise<string | null> {
  const id = videoId.trim();
  if (!/^[a-zA-Z0-9_-]{6,20}$/.test(id)) return null;
  return (
    (await fetchDirectYouTubeCaptionTrack(id)) ??
    (await fetchFreeTranscriptFallback(id))
  );
}
