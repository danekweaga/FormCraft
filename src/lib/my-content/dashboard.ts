import type { ContentPostRow } from "./schemas";

export const PERFORMANCE_RANGES = ["7", "30", "90", "all"] as const;
export type PerformanceRange = (typeof PERFORMANCE_RANGES)[number];

export type TopicPerformance = {
  topic: string;
  postCount: number;
  averageViews: number | null;
  totalViews: number | null;
  averageEngagements: number | null;
};

export type RemixIngredient = {
  postId: string;
  label: string;
  text: string;
  views: number | null;
};

function average(values: Array<number | null | undefined>): number | null {
  const usable = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (usable.length === 0) return null;
  return usable.reduce((total, value) => total + value, 0) / usable.length;
}

function sum(values: Array<number | null | undefined>): number | null {
  const usable = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (usable.length === 0) return null;
  return usable.reduce((total, value) => total + value, 0);
}

function engagement(post: ContentPostRow): number | null {
  return sum([post.likes, post.comments, post.shares, post.saves]);
}

function classificationString(post: ContentPostRow, key: string) {
  const value = post.classification?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function postTopic(post: ContentPostRow): string {
  return (
    post.topic?.trim() ||
    classificationString(post, "topic") ||
    post.content_pillar?.trim() ||
    classificationString(post, "content_pillar") ||
    "Unclassified"
  );
}

export function postHook(post: ContentPostRow): string | null {
  if (post.hook_text?.trim()) return post.hook_text.trim();
  const classified = classificationString(post, "hook_text");
  if (classified) return classified;
  return null;
}

export function filterPostsByPerformanceRange(
  posts: ContentPostRow[],
  range: PerformanceRange,
  now = new Date(),
): ContentPostRow[] {
  if (range === "all") return posts;
  const cutoff = now.getTime() - Number(range) * 86_400_000;
  return posts.filter((post) => {
    if (!post.published_at) return false;
    const published = new Date(post.published_at).getTime();
    return Number.isFinite(published) && published >= cutoff;
  });
}

export function buildTopicPerformance(
  posts: ContentPostRow[],
): TopicPerformance[] {
  const groups = new Map<string, ContentPostRow[]>();
  for (const post of posts) {
    const topic = postTopic(post);
    groups.set(topic, [...(groups.get(topic) ?? []), post]);
  }
  const hasClassifiedTopic = [...groups.keys()].some(
    (topic) => topic !== "Unclassified",
  );
  return [...groups.entries()]
    .filter(([topic]) => !hasClassifiedTopic || topic !== "Unclassified")
    .map(([topic, topicPosts]) => ({
      topic,
      postCount: topicPosts.length,
      averageViews: average(topicPosts.map((post) => post.views)),
      totalViews: sum(topicPosts.map((post) => post.views)),
      averageEngagements: average(topicPosts.map(engagement)),
    }))
    .sort((a, b) => (b.averageViews ?? -1) - (a.averageViews ?? -1));
}

export function buildRemixIngredients(posts: ContentPostRow[]): {
  topics: RemixIngredient[];
  hooks: RemixIngredient[];
} {
  const ranked = [...posts]
    .filter((post) => typeof post.views === "number")
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 12);

  const topics: RemixIngredient[] = [];
  const hooks: RemixIngredient[] = [];
  const seenTopics = new Set<string>();
  const seenHooks = new Set<string>();

  for (const post of ranked) {
    const topic = postTopic(post);
    const hook = postHook(post);
    if (topic !== "Unclassified" && !seenTopics.has(topic.toLowerCase())) {
      topics.push({
        postId: post.id,
        label: post.title || post.caption?.slice(0, 60) || "Source post",
        text: topic,
        views: post.views,
      });
      seenTopics.add(topic.toLowerCase());
    }
    if (hook && !seenHooks.has(hook.toLowerCase())) {
      hooks.push({
        postId: post.id,
        label: post.title || post.caption?.slice(0, 60) || "Source post",
        text: hook,
        views: post.views,
      });
      seenHooks.add(hook.toLowerCase());
    }
  }
  return { topics, hooks };
}
