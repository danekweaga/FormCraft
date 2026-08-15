import {
  inferFormatFromEvidence,
  FORMAT_LIBRARY,
  normalizeFormatSlug,
} from "@/lib/library/format-library";
import { postHook, postTopic } from "./dashboard";
import {
  getInstagramEmbedUrl,
  getPostEngagementRate,
  getPostEngagements,
} from "./performance";
import type { ContentPostRow } from "./schemas";

export type StrategyAuditDimension =
  | "topics"
  | "hooks"
  | "formats"
  | "scriptwriting";

export const STRATEGY_AUDIT_DIMENSIONS: Array<{
  id: StrategyAuditDimension;
  label: string;
}> = [
  { id: "topics", label: "Topics" },
  { id: "hooks", label: "Hooks" },
  { id: "formats", label: "Formats" },
  { id: "scriptwriting", label: "Scriptwriting tactics" },
];

export type StrategySupportingPost = {
  id: string;
  title: string;
  platform: string;
  thumbnailUrl: string | null;
  externalUrl: string | null;
  embedUrl: string | null;
  views: number | null;
  engagementRate: number | null;
  multiplier: number | null;
};

export type StrategyAuditGroup = {
  key: string;
  label: string;
  postCount: number;
  averageViews: number | null;
  multiplier: number | null;
  confidence: "low" | "medium" | "high";
  insights: string[];
  supportingPosts: StrategySupportingPost[];
};

function average(values: Array<number | null | undefined>): number | null {
  const usable = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (usable.length === 0) return null;
  return usable.reduce((total, value) => total + value, 0) / usable.length;
}

function sumAvailable(values: Array<number | null | undefined>): number | null {
  const usable = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (usable.length === 0) return null;
  return usable.reduce((total, value) => total + value, 0);
}

function classificationString(
  post: ContentPostRow,
  key: string,
): string | null {
  const value = post.classification?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function postTitle(post: ContentPostRow): string {
  return (
    post.title?.trim() ||
    post.caption?.trim().slice(0, 72) ||
    "Untitled post"
  );
}

function blob(post: ContentPostRow): string {
  return [post.hook_text, post.title, post.caption, post.topic]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

/** Infer hook family for audit buckets (Sandcastle-style). */
export function inferHookFamily(post: ContentPostRow): string {
  const classified =
    classificationString(post, "hook_type") ||
    classificationString(post, "hookType");
  if (classified) {
    return classified
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  const text = blob(post);
  if (
    /\b(\d+\s*(signs|ways|tips|reasons|mistakes|things|types)|top\s*\d+|tier\s*list|countdown)\b/.test(
      text,
    )
  ) {
    return "List";
  }
  if (/\b(problem|if you('re| are) still|stop doing|why you('re| are))\b/.test(text)) {
    return "Problem";
  }
  if (
    /\b(i used to|when i|my first|honestly|personal|happened to me|in my experience)\b/.test(
      text,
    )
  ) {
    return "Personal Experience";
  }
  if (
    /\b(unpopular|hot take|nobody talks|everyone is wrong|actually|contrary)\b/.test(
      text,
    )
  ) {
    return "Contrarian";
  }
  if (/\b(trap|mistake|don'?t|avoid|never)\b/.test(text)) {
    return "Trap Mistake";
  }
  const hook = postHook(post);
  return hook ? "Direct Promise" : "Unclassified hook";
}

export function inferFormatLabel(post: ContentPostRow): string {
  const slug =
    normalizeFormatSlug(post.format) ??
    inferFormatFromEvidence({
      title: post.title,
      description: post.caption,
      hookText: post.hook_text,
      transcript: post.transcript,
    });
  const match = FORMAT_LIBRARY.find((item) => item.slug === slug);
  return match?.name ?? post.format?.replace(/_/g, " ") ?? "Unknown format";
}

export function inferScriptwritingTactic(post: ContentPostRow): string {
  const structure = classificationString(post, "structure");
  if (structure) {
    return structure
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  const text = blob(post);
  if (
    /\b(\d+\s*(signs|ways|tips)|each (one|sign|tip) (is |gets )?(worse|harder|better)|escalat)/.test(
      text,
    )
  ) {
    return "Numbered Escalating List With Punchline Cap";
  }
  if (/\b(a vs b|versus|compared to|option a|option b)\b/.test(text)) {
    return "A Vs B Comparison";
  }
  if (/\b(problem|solution|fix|here'?s how|do this instead)\b/.test(text)) {
    return "Problem Solution";
  }
  if (/\b(listicle|\d+\s+things|top\s+\d+)\b/.test(text)) {
    return "Listicle";
  }
  if (/\b(common trap|mistake most|don'?t make this)\b/.test(text)) {
    return "Common Trap Mistake";
  }
  if (/\b(skit|sketch|bit|joke|comedy)\b/.test(text)) {
    return "Skit Humor";
  }
  if (/\b(call to action|follow for|comment|save this)\b/.test(text)) {
    return "Direct Address Call-to-action Close";
  }
  return "Open Narrative";
}

function groupKey(
  post: ContentPostRow,
  dimension: StrategyAuditDimension,
): string {
  if (dimension === "topics") return postTopic(post);
  if (dimension === "hooks") return inferHookFamily(post);
  if (dimension === "formats") return inferFormatLabel(post);
  return inferScriptwritingTactic(post);
}

function buildInsights(params: {
  label: string;
  dimension: StrategyAuditDimension;
  posts: ContentPostRow[];
  multiplier: number | null;
  accountAverage: number | null;
}): string[] {
  const { label, dimension, posts, multiplier } = params;
  const insights: string[] = [];
  const totalViews = sumAvailable(posts.map((post) => post.views));
  const totalEngagements = sumAvailable(posts.map(getPostEngagements));
  const top = [...posts].sort((a, b) => (b.views ?? -1) - (a.views ?? -1))[0];

  if (multiplier != null) {
    insights.push(
      `${label} averages ${multiplier.toFixed(2)}× your baseline across ${posts.length} post${posts.length === 1 ? "" : "s"} in this window.`,
    );
  } else {
    insights.push(
      "A multiplier is unavailable until more posts in this bucket have view metrics.",
    );
  }

  if (dimension === "topics" && top) {
    const hook = postHook(top);
    if (hook) {
      insights.push(
        `Strongest supporting post opens with “${hook.slice(0, 120)}” (${top.views?.toLocaleString() ?? "—"} views).`,
      );
    }
  }

  if (dimension === "hooks") {
    insights.push(
      multiplier != null && multiplier >= 1
        ? `${label} hooks are beating your baseline — remake the promise structure, not just the wording.`
        : `${label} hooks are under baseline here. Pair them with a stronger topic or identity angle before retiring the family.`,
    );
  }

  if (dimension === "formats") {
    insights.push(
      `Treat format as a container: ${label} only wins when the topic and payoff stay specific.`,
    );
  }

  if (dimension === "scriptwriting") {
    insights.push(
      multiplier != null && multiplier >= 1
        ? `${label} is carrying completion/share potential in this sample — keep the open loop and escalate stakes.`
        : `${label} is soft in this sample. Check whether the payoff actually closes the opening loop.`,
    );
  }

  if (totalEngagements != null && totalViews != null && totalViews > 0) {
    insights.push(
      `Measured ${(totalEngagements / totalViews) * 1000 >= 1 ? ((totalEngagements / totalViews) * 1000).toFixed(1) : ((totalEngagements / totalViews) * 1000).toFixed(2)} engagements per 1,000 views in this bucket.`,
    );
  }

  if (posts.length < 3) {
    insights.push(
      "Evidence is early — publish at least three comparable posts before treating this as a stable pattern.",
    );
  }

  return insights;
}

export function buildStrategyAudits(
  posts: ContentPostRow[],
  dimension: StrategyAuditDimension,
): StrategyAuditGroup[] {
  const accountAverage = average(posts.map((post) => post.views));
  const groups = new Map<string, ContentPostRow[]>();

  for (const post of posts) {
    const key = groupKey(post, dimension);
    groups.set(key, [...(groups.get(key) ?? []), post]);
  }

  const entries = [...groups.entries()];
  const hasNamed = entries.some(
    ([key]) =>
      !key.toLowerCase().includes("unclassified") &&
      key !== "Unknown format" &&
      key !== "Open Narrative",
  );

  return entries
    .filter(([key]) => {
      if (!hasNamed) return true;
      return (
        !key.toLowerCase().includes("unclassified") &&
        key !== "Unknown format"
      );
    })
    .map(([label, groupPosts]) => {
      const ranked = [...groupPosts].sort(
        (a, b) => (b.views ?? -1) - (a.views ?? -1),
      );
      const averageViews = average(groupPosts.map((post) => post.views));
      const multiplier =
        averageViews != null && accountAverage != null && accountAverage > 0
          ? averageViews / accountAverage
          : null;

      return {
        key: label,
        label,
        postCount: groupPosts.length,
        averageViews,
        multiplier,
        confidence:
          groupPosts.length >= 5
            ? ("high" as const)
            : groupPosts.length >= 3
              ? ("medium" as const)
              : ("low" as const),
        insights: buildInsights({
          label,
          dimension,
          posts: groupPosts,
          multiplier,
          accountAverage,
        }),
        supportingPosts: ranked.slice(0, 6).map((post) => {
          const views = typeof post.views === "number" ? post.views : null;
          return {
            id: post.id,
            title: postTitle(post),
            platform: post.platform,
            thumbnailUrl: post.thumbnail_url ?? null,
            externalUrl: post.external_url ?? null,
            embedUrl:
              post.platform === "instagram"
                ? getInstagramEmbedUrl(post.external_url)
                : null,
            views,
            engagementRate: getPostEngagementRate(post)?.value ?? null,
            multiplier:
              views != null && accountAverage != null && accountAverage > 0
                ? views / accountAverage
                : null,
          };
        }),
      };
    })
    .sort((a, b) => (b.multiplier ?? -1) - (a.multiplier ?? -1));
}

/** Last N posts by publish date for Sandcastle-style “last 30 videos”. */
export function takeRecentPostsForAudit(
  posts: ContentPostRow[],
  limit = 30,
): ContentPostRow[] {
  return [...posts]
    .filter((post) => post.published_at)
    .sort(
      (a, b) =>
        new Date(b.published_at!).getTime() -
        new Date(a.published_at!).getTime(),
    )
    .slice(0, limit);
}
