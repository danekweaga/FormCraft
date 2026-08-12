import { compactDiscoveryQuery } from "../search-filters";
import type {
  ContentDiscoveryProvider,
  CreatorPostsInput,
  DiscoveryCapabilities,
  SearchPostResult,
  SearchPostsInput,
} from "./types";

const BASE = "https://api.tiktokapi.store/api/v1";

export function isTiktokDataApiConfigured(): boolean {
  return Boolean(process.env.TIKTOK_DATA_API_KEY?.trim());
}

function apiKey(): string {
  const key = process.env.TIKTOK_DATA_API_KEY?.trim();
  if (!key) throw new Error("TIKTOK_DATA_API_KEY is not configured.");
  return key;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** TikTok APIs often return duration in milliseconds. */
export function normalizeTiktokDurationSeconds(value: unknown): number | null {
  const raw = asNumber(value);
  if (raw == null || raw <= 0) return null;
  if (raw > 1000) return Math.round(raw / 1000);
  return Math.round(raw);
}

async function tiktokGet(path: string, params: Record<string, string>) {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey()}` },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    const message =
      asString(body.message) ??
      asString(body.error) ??
      `TikTokAPI.store failed (${response.status})`;
    console.error("[tiktokapi_store] request failed", {
      path,
      status: response.status,
      message,
    });
    throw new Error(message);
  }
  return body;
}

async function tiktokGetFirst(
  attempts: Array<{ path: string; params: Record<string, string> }>,
): Promise<{ body: Record<string, unknown>; path: string; items: unknown[] }> {
  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      const body = await tiktokGet(attempt.path, attempt.params);
      const items = extractList(body);
      if (items.length === 0) {
        console.warn("[tiktokapi_store] empty payload, trying next endpoint", {
          path: attempt.path,
        });
        lastError = new Error(`Empty response from ${attempt.path}`);
        continue;
      }
      console.info("[tiktokapi_store] using endpoint", {
        path: attempt.path,
        count: items.length,
      });
      return { body, path: attempt.path, items };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("TikTokAPI.store request failed.");
}

const LIST_KEYS = [
  "videos",
  "aweme_list",
  "item_list",
  "video_list",
  "items",
  "list",
  "results",
  "search_item_list",
] as const;

function extractList(body: Record<string, unknown>): unknown[] {
  if (Array.isArray(body.data)) return body.data;
  const data = pickRecord(body.data);
  if (data) {
    for (const key of LIST_KEYS) {
      const value = data[key];
      if (Array.isArray(value) && value.length > 0) return value;
    }
    const nested = pickRecord(data.data);
    if (nested) {
      for (const key of LIST_KEYS) {
        const value = nested[key];
        if (Array.isArray(value) && value.length > 0) return value;
      }
    }
  }
  for (const key of LIST_KEYS) {
    const value = body[key];
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
}

/** Normalize varied TikTokAPI.store video shapes into SearchPostResult. */
export function normalizeTiktokVideo(
  raw: unknown,
  retrievedAt: string,
): SearchPostResult | null {
  const wrapped = pickRecord(raw);
  if (!wrapped) return null;
  const item =
    pickRecord(wrapped.aweme_info) ??
    pickRecord(wrapped.aweme) ??
    pickRecord(wrapped.item) ??
    wrapped;
  const stats =
    pickRecord(item.stats) ??
    pickRecord(item.statistics) ??
    pickRecord(item.stat) ??
    {};
  const author =
    pickRecord(item.author) ??
    pickRecord(item.user) ??
    pickRecord(item.authorMeta) ??
    {};
  const video = pickRecord(item.video) ?? {};

  const id =
    asString(item.id) ??
    asString(item.aweme_id) ??
    asString(item.video_id) ??
    asString(item.videoId) ??
    asString(video.id) ??
    asString(wrapped.aweme_id);
  if (!id) return null;

  const handle =
    asString(author.unique_id) ??
    asString(author.uniqueId) ??
    asString(author.username) ??
    asString(item.unique_id) ??
    asString(item.uniqueId);
  const creatorId =
    asString(author.id) ??
    asString(author.uid) ??
    asString(author.sec_uid) ??
    handle;
  const title =
    asString(item.desc) ??
    asString(item.title) ??
    asString(item.description) ??
    asString(item.caption);

  const createTime =
    asNumber(item.create_time) ??
    asNumber(item.createTime) ??
    asNumber(item.published_at);
  const publishedAt =
    asString(item.published_at) ??
    asString(item.create_time_iso) ??
    (createTime && createTime > 1_000_000_000
      ? new Date(
          createTime > 10_000_000_000 ? createTime : createTime * 1000,
        ).toISOString()
      : null);

  const cover =
    asString(item.cover) ??
    asString(item.coverUrl) ??
    asString(video.cover) ??
    asString(video.origin_cover) ??
    asString(video.dynamic_cover);

  return {
    platform: "tiktok",
    externalId: id,
    externalUrl:
      asString(item.share_url) ??
      asString(item.url) ??
      (handle
        ? `https://www.tiktok.com/@${handle}/video/${id}`
        : `https://www.tiktok.com/video/${id}`),
    creatorId: creatorId ?? null,
    creatorName:
      asString(author.nickname) ??
      asString(author.nickName) ??
      handle,
    title,
    description: title,
    thumbnailUrl: cover,
    publishedAt,
    durationSeconds:
      normalizeTiktokDurationSeconds(item.duration) ??
      normalizeTiktokDurationSeconds(video.duration) ??
      normalizeTiktokDurationSeconds(item.video_duration),
    views:
      asNumber(stats.play_count) ??
      asNumber(stats.playCount) ??
      asNumber(stats.views) ??
      asNumber(item.play_count) ??
      asNumber(item.playCount) ??
      asNumber(item.views) ??
      asNumber(wrapped.play_count),
    likes:
      asNumber(stats.digg_count) ??
      asNumber(stats.diggCount) ??
      asNumber(stats.likes) ??
      asNumber(item.digg_count),
    comments:
      asNumber(stats.comment_count) ??
      asNumber(stats.commentCount) ??
      asNumber(item.comment_count),
    shares:
      asNumber(stats.share_count) ??
      asNumber(stats.shareCount) ??
      asNumber(item.share_count),
    providerName: "tiktokapi_store",
    collectionMethod: "third_party_search",
    retrievedAt,
    creatorFollowerCount:
      asNumber(author.follower_count) ??
      asNumber(author.followerCount) ??
      null,
  };
}

export const tiktokDataDiscoveryProvider: ContentDiscoveryProvider = {
  providerName: "tiktokapi_store",

  capabilities(): DiscoveryCapabilities {
    const configured = isTiktokDataApiConfigured();
    return {
      searchPosts: configured,
      searchCreators: false,
      getCreatorPosts: configured,
      refreshMetrics: false,
      getCreatorBaseline: false,
      platforms: ["tiktok"],
      providerType: "third_party",
    };
  },

  async searchPosts(input: SearchPostsInput): Promise<SearchPostResult[]> {
    if (!isTiktokDataApiConfigured()) return [];
    if (input.platforms && !input.platforms.includes("tiktok")) return [];

    const retrievedAt = new Date().toISOString();
    const count = String(Math.min(30, Math.max(1, input.maxResults ?? 30)));
    const maxResults = input.maxResults ?? 25;
    const minViews = input.minViews ?? 0;
    const lookbackMs = (input.lookbackDays ?? 30) * 86_400_000;
    const cutoff = Date.now() - lookbackMs;
    const q = compactDiscoveryQuery(input.query);

    // Few attempts: Hobby timeouts kill long fallback chains. Continue when the
    // first non-empty search is all older than lookback (common for keyword rank).
    const attempts: Array<{
      path: string;
      params: Record<string, string>;
    }> = [
      { path: "/search/videos", params: { keyword: q, count } },
      { path: "/search/video", params: { keyword: q, count } },
      { path: "/feed/trending", params: { region: "US", count } },
    ];

    let lastUsable: SearchPostResult[] = [];
    let lastError: Error | null = null;
    for (const attempt of attempts) {
      try {
        const body = await tiktokGet(attempt.path, attempt.params);
        const items = extractList(body);
        if (items.length === 0) {
          lastError = new Error(`Empty response from ${attempt.path}`);
          continue;
        }
        const posts = items
          .map((raw) => normalizeTiktokVideo(raw, retrievedAt))
          .filter((post): post is SearchPostResult => Boolean(post))
          .filter((post) => post.views == null || post.views >= minViews)
          .map((post) => ({
            ...post,
            collectionMethod: "third_party_search" as const,
          }));
        if (posts.length === 0) {
          lastError = new Error(`Unusable payload from ${attempt.path}`);
          continue;
        }
        lastUsable = posts;
        const recent = posts.filter((post) => {
          if (!post.publishedAt) return true;
          const t = new Date(post.publishedAt).getTime();
          return Number.isFinite(t) ? t >= cutoff : true;
        });
        if (recent.length > 0) {
          console.info("[tiktokapi_store] using endpoint", {
            path: attempt.path,
            count: recent.length,
          });
          return recent.slice(0, maxResults);
        }
        lastError = new Error(`No recent posts from ${attempt.path}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (lastUsable.length > 0) return lastUsable.slice(0, maxResults);
    throw lastError ?? new Error("TikTokAPI.store request failed.");
  },

  async getCreatorPosts(input: CreatorPostsInput): Promise<SearchPostResult[]> {
    if (!isTiktokDataApiConfigured()) return [];
    if (input.platform !== "tiktok") return [];

    const retrievedAt = new Date().toISOString();
    const count = String(Math.min(30, Math.max(1, input.maxResults ?? 10)));
    const handle = input.platformCreatorId.replace(/^@/, "");

    const identifier: Record<string, string> = /^\d+$/.test(handle)
      ? { user_id: handle }
      : { unique_id: handle };
    const { items } = await tiktokGetFirst([
      { path: "/user/posts", params: { ...identifier, count } },
      { path: "/user/videos", params: { ...identifier, count } },
    ]);

    return items
      .map((raw) => normalizeTiktokVideo(raw, retrievedAt))
      .filter((post): post is SearchPostResult => Boolean(post))
      .map((post) => ({
        ...post,
        collectionMethod: "third_party_creator_posts",
        creatorId: post.creatorId ?? handle,
      }))
      .slice(0, input.maxResults ?? 10);
  },
};
