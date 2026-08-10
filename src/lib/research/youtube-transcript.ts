/**
 * Fetch a public YouTube caption track as plain text when available.
 * Uses the watch-page captionTracks metadata (no Data API captions.list OAuth).
 * Returns null when captions are disabled, missing, or the page shape changes.
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

export async function fetchYouTubeTranscript(
  videoId: string,
): Promise<string | null> {
  const id = videoId.trim();
  if (!/^[a-zA-Z0-9_-]{6,20}$/.test(id)) return null;

  try {
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${id}`, {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (compatible; FormCraftResearch/1.0; +https://formcraft.app)",
      },
      next: { revalidate: 0 },
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
    });
    if (!captionRes.ok) return null;
    const body = await captionRes.text();
    const plain = timedTextXmlToPlain(body);
    if (plain.length < 40) return null;
    return plain.slice(0, 40_000);
  } catch {
    return null;
  }
}
