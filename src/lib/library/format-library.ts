export type FormatDefinition = {
  slug: string;
  name: string;
  family: "Direct-to-camera" | "Educational" | "Narrative" | "Entertainment" | "Visual";
  description: string;
};

export const FORMAT_LIBRARY: FormatDefinition[] = [
  { slug: "yap", name: "Yap", family: "Direct-to-camera", description: "Opinion-led or explanatory direct-to-camera delivery." },
  { slug: "talking-head", name: "Talking Head", family: "Direct-to-camera", description: "Single-speaker delivery with light visual support." },
  { slug: "walking-yap", name: "Walking Yap", family: "Direct-to-camera", description: "Direct-to-camera delivery while moving through a location." },
  { slug: "explainer", name: "Explainer", family: "Educational", description: "Breaks down a concept with a clear teaching structure." },
  { slug: "tutorial", name: "Tutorial", family: "Educational", description: "Step-by-step instruction toward a concrete outcome." },
  { slug: "screen-recording", name: "Screen Recording", family: "Visual", description: "Demonstrates a product, workflow, or code directly on screen." },
  { slug: "storytime", name: "Storytime", family: "Narrative", description: "Personal or observed story with setup, tension, and payoff." },
  { slug: "personal-story", name: "Personal Story", family: "Narrative", description: "Experience-led proof or lesson grounded in the creator's life." },
  { slug: "list", name: "List", family: "Educational", description: "A bounded set of examples, signs, mistakes, or steps." },
  { slug: "breakdown", name: "Breakdown", family: "Educational", description: "Deconstructs why an example, system, or result works." },
  { slug: "reaction", name: "Reaction", family: "Entertainment", description: "Responds to an existing claim, clip, trend, or event." },
  { slug: "skit", name: "Skit", family: "Entertainment", description: "Scripted characters or situations used to deliver the idea." },
  { slug: "meme-led", name: "Meme-led", family: "Entertainment", description: "Uses recognizable internet language or meme structure as the entry point." },
  { slug: "interview", name: "Interview", family: "Narrative", description: "Question-and-answer content featuring another person." },
  { slug: "voice-over", name: "Voice-over", family: "Visual", description: "Narration layered over demonstrations, footage, or a visual sequence." },
  { slug: "carousel", name: "Carousel", family: "Visual", description: "Swipeable visual sequence organized as a compact argument or guide." },
  { slug: "panel", name: "Panel", family: "Narrative", description: "Multi-person discussion or debate around a shared question." },
];

const aliases: Record<string, string> = {
  reel: "talking-head",
  video: "talking-head",
  short_video: "talking-head",
  carousel_album: "carousel",
  screen_share: "screen-recording",
  screenrecording: "screen-recording",
  story_time: "storytime",
  personal_story: "personal-story",
  talking_head: "talking-head",
  walking_yap: "walking-yap",
  voice_over: "voice-over",
  meme: "meme-led",
};

export function normalizeFormatSlug(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-");
  return aliases[normalized] ?? aliases[normalized.replace(/-/g, "_")] ?? normalized;
}

export function extractRelativeMultiplier(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["views", "viewMultiplier", "multiplier", "overall"]) {
    const candidate = record[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }
  return null;
}
