import { z } from "zod";
import type { InstagramAccountInsights } from "./types";

const nullableMetric = z.number().finite().nonnegative().nullable();

const breakdownSchema = z.object({
  label: z.string(),
  value: z.number().finite().nonnegative(),
});

const instagramAccountInsightsSchema = z.object({
  capturedAt: z.string(),
  rangeStart: z.string(),
  rangeEnd: z.string(),
  totals: z.object({
    views: nullableMetric,
    reach: nullableMetric,
    profileViews: nullableMetric,
    accountsEngaged: nullableMetric,
    totalInteractions: nullableMetric,
    likes: nullableMetric,
    comments: nullableMetric,
    shares: nullableMetric,
    saves: nullableMetric,
    replies: nullableMetric,
    profileLinksTaps: nullableMetric,
    follows: nullableMetric,
    unfollows: nullableMetric,
  }),
  daily: z.array(
    z.object({
      date: z.string(),
      reach: nullableMetric,
      followerCount: nullableMetric,
      views: nullableMetric.optional(),
    }),
  ),
  audience: z.object({
    gender: z.array(breakdownSchema),
    age: z.array(breakdownSchema),
    country: z.array(breakdownSchema),
    city: z.array(breakdownSchema),
  }),
});

export function getInstagramAccountInsights(
  metadata: unknown,
): InstagramAccountInsights | null {
  if (!metadata || typeof metadata !== "object") return null;
  const result = instagramAccountInsightsSchema.safeParse(
    (metadata as { accountInsights?: unknown }).accountInsights,
  );
  return result.success ? result.data : null;
}

