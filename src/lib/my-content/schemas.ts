import { z } from "zod";

export const contentPlatforms = [
  "instagram",
  "tiktok",
  "youtube_shorts",
  "youtube",
  "linkedin",
  "x",
  "threads",
  "other",
] as const;

const optionalMetric = z
  .union([z.coerce.number().nonnegative(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => {
    if (value === "" || value === null || value === undefined) return null;
    return value;
  });

export const manualPostSchema = z.object({
  platform: z.enum(contentPlatforms),
  title: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => v || null),
  caption: z.string().trim().min(1, "Caption is required").max(20_000),
  publishedAt: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v : null)),
  views: optionalMetric,
  likes: optionalMetric,
  comments: optionalMetric,
  shares: optionalMetric,
  saves: optionalMetric,
  followers_gained: optionalMetric,
});

export type ManualPostInput = z.infer<typeof manualPostSchema>;

export type ContentPostMetrics = {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  followers_gained: number | null;
};

export type ContentPostRow = ContentPostMetrics & {
  id: string;
  platform: string;
  source: string;
  source_label: string;
  external_url?: string | null;
  thumbnail_url?: string | null;
  title: string | null;
  caption: string | null;
  transcript?: string | null;
  topic?: string | null;
  content_pillar?: string | null;
  hook_text?: string | null;
  classification?: Record<string, unknown>;
  format?: string | null;
  published_at: string | null;
  reach?: number | null;
  watch_time_seconds?: number | null;
  average_view_duration_seconds?: number | null;
  completion_rate?: number | null;
  profile_visits?: number | null;
  link_clicks?: number | null;
  is_winner: boolean;
  needs_review: boolean;
  relative_performance: Record<string, unknown>;
  created_at: string;
  metrics_refreshed_at?: string | null;
  social_connection_id?: string | null;
};
