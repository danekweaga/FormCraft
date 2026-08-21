import type { ContentPostRow } from "@/lib/my-content/schemas";
import type {
  ReportConfidence,
  ReportDataQuality,
  ReportMetricGroup,
} from "./types";

function numbers(values: Array<number | null | undefined>): number[] {
  return values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
}

export function median(values: Array<number | null | undefined>): number | null {
  const sorted = numbers(values).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function confidence(sampleSize: number): ReportConfidence {
  if (sampleSize >= 8) return "high";
  if (sampleSize >= 3) return "medium";
  return "low";
}

function classified(post: ContentPostRow, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = post.classification?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function text(post: ContentPostRow): string {
  return [post.hook_text, post.title, post.caption, post.transcript]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function reportTopic(post: ContentPostRow): string {
  return (
    post.content_pillar?.trim() ||
    post.topic?.trim() ||
    classified(post, "content_pillar", "contentPillar", "topic") ||
    "Unclassified"
  );
}

export function reportHook(post: ContentPostRow): string {
  const raw = classified(post, "hook_type", "hookType")?.toLowerCase() ?? "";
  const blob = `${raw} ${text(post)}`;
  if (/contrarian|hot take|unpopular|everyone is wrong/.test(blob)) return "Contrarian";
  if (/curiosity|secret|nobody tells|wait until|you won't believe/.test(blob)) return "Curiosity";
  if (/identity|you are|for (cs|computer science|student|developer)/.test(blob)) return "Identity";
  if (/story|when i|i used to|happened to me/.test(blob)) return "Story";
  if (/question|\?$|why (do|does|are|is)|have you/.test(blob)) return "Question";
  if (/pain|problem|struggl|stuck|frustrat/.test(blob)) return "Pain";
  if (/result|how i|i got|before and after|from .* to/.test(blob)) return "Result-first";
  if (/warning|don't|never|avoid|mistake|stop/.test(blob)) return "Warning";
  return "Other";
}

export function reportFormat(post: ContentPostRow): string {
  const raw = `${post.format ?? ""} ${classified(post, "format") ?? ""} ${text(post)}`.toLowerCase();
  if (/walking yap|walk and talk/.test(raw)) return "Walking Yap";
  if (/talking head|direct.to.camera/.test(raw)) return "Talking Head";
  if (/screen recording|screencast/.test(raw)) return "Screen Recording";
  if (/carousel/.test(raw)) return "Carousel";
  if (/tutorial|how.to/.test(raw)) return "Tutorial";
  if (/explainer/.test(raw)) return "Explainer";
  if (/story/.test(raw)) return "Story";
  if (/meme/.test(raw)) return "Meme-led";
  if (/yap|monologue/.test(raw)) return "Yap";
  return "Other";
}

function engagementRate(post: ContentPostRow): number | null {
  const denominator = post.reach ?? post.views;
  if (!denominator || denominator <= 0) return null;
  const measured = numbers([post.likes, post.comments, post.shares, post.saves]);
  if (!measured.length) return null;
  return measured.reduce((sum, value) => sum + value, 0) / denominator;
}

export function buildMetricGroups(
  posts: ContentPostRow[],
  keyFor: (post: ContentPostRow) => string,
): ReportMetricGroup[] {
  const accountMedianViews = median(posts.map((post) => post.views));
  const groups = new Map<string, ContentPostRow[]>();
  for (const post of posts) {
    const key = keyFor(post);
    groups.set(key, [...(groups.get(key) ?? []), post]);
  }

  return [...groups.entries()]
    .map(([label, groupPosts]): ReportMetricGroup => {
      const groupMedianViews = median(groupPosts.map((post) => post.views));
      const relative =
        groupMedianViews != null && accountMedianViews != null && accountMedianViews > 0
          ? groupMedianViews / accountMedianViews
          : null;
      const ranked = [...groupPosts].sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
      const commentValues = numbers(groupPosts.map((post) => post.comments));
      const commentMedian = median(commentValues);
      const accountCommentMedian = median(posts.map((post) => post.comments));
      return {
        key: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        label,
        sampleSize: groupPosts.length,
        medianRelativeViews: relative,
        medianShares: median(groupPosts.map((post) => post.shares)),
        medianSaves: median(groupPosts.map((post) => post.saves)),
        medianComments: commentMedian,
        medianEngagementRate: median(groupPosts.map(engagementRate)),
        conversationSignal:
          !commentValues.length || accountCommentMedian == null
            ? "unavailable"
            : commentMedian != null && commentMedian >= accountCommentMedian * 1.5
              ? "strong"
              : commentMedian != null && commentMedian >= accountCommentMedian
                ? "mixed"
                : "weak",
        confidence: confidence(groupPosts.length),
        supportingPostIds: ranked.slice(0, 3).map((post) => post.id),
        contradictoryPostIds: ranked
          .filter((post) => accountMedianViews != null && (post.views ?? accountMedianViews) < accountMedianViews)
          .slice(-2)
          .map((post) => post.id),
      };
    })
    .sort((a, b) => (b.medianRelativeViews ?? -1) - (a.medianRelativeViews ?? -1));
}

export function buildDataQuality(
  posts: ContentPostRow[],
  postsWithAudienceComments: number,
): ReportDataQuality {
  const metricPosts = posts.filter((post) =>
    [post.views, post.reach, post.likes, post.comments, post.shares, post.saves].some(
      (value) => typeof value === "number",
    ),
  );
  const newestMetricAt = posts
    .map((post) => post.metrics_refreshed_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  const ageHours = newestMetricAt
    ? (Date.now() - new Date(newestMetricAt).getTime()) / 3_600_000
    : null;
  const warnings: string[] = [];
  if (posts.length < 5) warnings.push("Fewer than five eligible posts; patterns are descriptive, not reliable.");
  if (metricPosts.length < posts.length) warnings.push("Some posts have no performance metrics.");
  if (!posts.some((post) => post.watch_time_seconds != null || post.completion_rate != null)) {
    warnings.push("Retention metrics are unavailable, so retention causes cannot be inferred.");
  }
  if (!postsWithAudienceComments) warnings.push("No audience comments are linked to these posts.");
  return {
    eligiblePosts: posts.length,
    postsWithMetrics: metricPosts.length,
    metricsCoveragePct: posts.length ? Math.round((metricPosts.length / posts.length) * 100) : 0,
    hookClassifications: posts.filter((post) => reportHook(post) !== "Other").length,
    formatClassifications: posts.filter((post) => reportFormat(post) !== "Other").length,
    topicClassifications: posts.filter((post) => reportTopic(post) !== "Unclassified").length,
    postsWithAudienceComments,
    retentionAvailable: posts.filter((post) => post.watch_time_seconds != null || post.completion_rate != null).length,
    newestMetricAt,
    freshness: ageHours == null ? "unknown" : ageHours <= 72 ? "fresh" : ageHours <= 168 ? "aging" : "stale",
    warnings,
    confidence: confidence(Math.min(posts.length, metricPosts.length)),
  };
}
