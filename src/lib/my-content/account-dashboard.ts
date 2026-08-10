import type { InstagramAccountInsights } from "@/lib/social/types";
import { postHook, postTopic, type PerformanceRange } from "./dashboard";
import {
  getPostEngagementRate,
  getPostEngagements,
} from "./performance";
import type { ContentPostRow } from "./schemas";

const DAY_MS = 86_400_000;

export type DashboardPoint = {
  date: string;
  value: number;
};

export type DashboardSupportingPost = {
  id: string;
  title: string;
  platform: string;
  thumbnailUrl: string | null;
  views: number | null;
  engagementRate: number | null;
};

export type DashboardTopicAudit = {
  topic: string;
  postCount: number;
  averageViews: number | null;
  multiplier: number | null;
  confidence: "low" | "medium" | "high";
  insights: string[];
  supportingPosts: DashboardSupportingPost[];
};

function finite(values: Array<number | null | undefined>): number[] {
  return values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
}

function average(values: Array<number | null | undefined>): number | null {
  const usable = finite(values);
  if (usable.length === 0) return null;
  return usable.reduce((total, value) => total + value, 0) / usable.length;
}

function sumAvailable(values: Array<number | null | undefined>): number | null {
  const usable = finite(values);
  if (usable.length === 0) return null;
  return usable.reduce((total, value) => total + value, 0);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function postTitle(post: ContentPostRow): string {
  return post.title?.trim() || post.caption?.trim().slice(0, 72) || "Untitled post";
}

export function filterPostsByConnection(
  posts: ContentPostRow[],
  connectionId: string | null,
): ContentPostRow[] {
  if (!connectionId) return posts;
  return posts.filter((post) => post.social_connection_id === connectionId);
}

export function filterPostsByPreviousRange(
  posts: ContentPostRow[],
  range: PerformanceRange,
  now = new Date(),
): ContentPostRow[] {
  if (range === "all") return [];
  const days = Number(range);
  const end = now.getTime() - days * DAY_MS;
  const start = end - days * DAY_MS;
  return posts.filter((post) => {
    if (!post.published_at) return false;
    const published = new Date(post.published_at).getTime();
    return Number.isFinite(published) && published >= start && published < end;
  });
}

export function percentageChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function buildCumulativePoints(
  points: DashboardPoint[],
  startingValue = 0,
): DashboardPoint[] {
  let running = startingValue;
  return points.map((point) => {
    running += point.value;
    return { date: point.date, value: running };
  });
}

export function buildAccountFollowerSeries(params: {
  insights: InstagramAccountInsights[];
  days: number;
  now?: Date;
}): DashboardPoint[] {
  const now = params.now ?? new Date();
  const end = new Date(`${dateKey(now)}T00:00:00.000Z`);
  const start = new Date(end.getTime() - (params.days - 1) * DAY_MS);
  const values = new Map<string, number>();

  for (const insight of params.insights) {
    for (const point of insight.daily) {
      if (typeof point.followerCount !== "number") continue;
      values.set(point.date, (values.get(point.date) ?? 0) + point.followerCount);
    }
  }

  const points: DashboardPoint[] = [];
  for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) {
    const date = dateKey(new Date(time));
    points.push({ date, value: values.get(date) ?? 0 });
  }
  return points;
}

export function aggregateInstagramAccountTotals(
  insights: InstagramAccountInsights[],
): InstagramAccountInsights["totals"] {
  const metric = (key: keyof InstagramAccountInsights["totals"]) =>
    sumAvailable(insights.map((insight) => insight.totals[key]));

  return {
    views: metric("views"),
    reach: metric("reach"),
    profileViews: metric("profileViews"),
    accountsEngaged: metric("accountsEngaged"),
    totalInteractions: metric("totalInteractions"),
    likes: metric("likes"),
    comments: metric("comments"),
    shares: metric("shares"),
    saves: metric("saves"),
    replies: metric("replies"),
    profileLinksTaps: metric("profileLinksTaps"),
    follows: metric("follows"),
    unfollows: metric("unfollows"),
  };
}

export function buildDashboardTopicAudits(
  posts: ContentPostRow[],
): DashboardTopicAudit[] {
  const accountAverage = average(posts.map((post) => post.views));
  const groups = new Map<string, ContentPostRow[]>();

  for (const post of posts) {
    const topic = postTopic(post);
    groups.set(topic, [...(groups.get(topic) ?? []), post]);
  }

  const groupedTopics = [...groups.entries()];
  const hasClassifiedTopic = groupedTopics.some(
    ([topic]) => topic !== "Unclassified",
  );

  return groupedTopics
    .filter(([topic]) => !hasClassifiedTopic || topic !== "Unclassified")
    .map(([topic, topicPosts]) => {
      const ranked = [...topicPosts].sort(
        (a, b) => (b.views ?? -1) - (a.views ?? -1),
      );
      const averageViews = average(topicPosts.map((post) => post.views));
      const multiplier =
        averageViews !== null && accountAverage !== null && accountAverage > 0
          ? averageViews / accountAverage
          : null;
      const totalViews = sumAvailable(topicPosts.map((post) => post.views));
      const totalEngagements = sumAvailable(topicPosts.map(getPostEngagements));
      const topPost = ranked[0] ?? null;
      const hook = topPost ? postHook(topPost) : null;
      const formats = new Map<string, number>();
      for (const post of topicPosts) {
        const format = post.format?.replace(/_/g, " ") || "unknown format";
        formats.set(format, (formats.get(format) ?? 0) + 1);
      }
      const leadingFormat = [...formats.entries()].sort((a, b) => b[1] - a[1])[0];
      const insights: string[] = [];

      if (multiplier !== null) {
        insights.push(
          `${topic} averages ${multiplier.toFixed(2)}× your selected-channel view baseline across ${topicPosts.length} post${topicPosts.length === 1 ? "" : "s"}.`,
        );
      } else {
        insights.push("A view multiplier is unavailable until more posts have view metrics.");
      }
      if (hook && topPost?.views !== null) {
        insights.push(
          `The strongest supporting post opens with “${hook.slice(0, 120)}” and currently has ${topPost.views.toLocaleString()} views.`,
        );
      }
      if (totalEngagements !== null && totalViews !== null && totalViews > 0) {
        insights.push(
          `This topic produced ${((totalEngagements / totalViews) * 1_000).toFixed(1)} measured engagements per 1,000 views.`,
        );
      }
      if (leadingFormat) {
        insights.push(
          `${leadingFormat[0]} is the most-used format in this topic (${leadingFormat[1]} post${leadingFormat[1] === 1 ? "" : "s"}); treat that as an association to test, not proof of cause.`,
        );
      }
      if (topicPosts.length < 3) {
        insights.push("Evidence is early: publish at least three comparable posts before treating this as a stable pattern.");
      }

      return {
        topic,
        postCount: topicPosts.length,
        averageViews,
        multiplier,
        confidence:
          topicPosts.length >= 5
            ? ("high" as const)
            : topicPosts.length >= 3
              ? ("medium" as const)
              : ("low" as const),
        insights,
        supportingPosts: ranked.slice(0, 3).map((post) => ({
          id: post.id,
          title: postTitle(post),
          platform: post.platform,
          thumbnailUrl: post.thumbnail_url ?? null,
          views: post.views,
          engagementRate: getPostEngagementRate(post)?.value ?? null,
        })),
      };
    })
    .sort((a, b) => (b.multiplier ?? -1) - (a.multiplier ?? -1));
}
