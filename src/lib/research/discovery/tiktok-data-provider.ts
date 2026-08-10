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
    throw new Error(
      asString(body.message) ??
        asString(body.error) ??
        `TikTokAPI.store failed (${response.status})`,
    );
  }
  return body;
}

function extractList(body: Record<string, unknown>): unknown[] {
  const data = body.data;
  if (Array.isArray(data)) return data;
  const record = pickRecord(data);
  if (!record) return [];
  for (const key of ["videos", "aweme_list", "items", "list", "results"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

/** Normalize varied TikTokAPI.store video shapes into SearchPostResult. */
export function normalizeTiktokVideo(
  raw: unknown,
  retrievedAt: string,
): SearchPostResult | null {
  const item = pickRecord(raw);
  if (!item) return null;
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

  const id =
    asString(item.id) ??
    asString(item.aweme_id) ??
    asString(item.video_id) ??
    asString(item.videoId);
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
    asString(pickRecord(item.video)?.cover) ??
    asString(pickRecord(item.video)?.origin_cover);

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
      asNumber(item.duration) ??
      asNumber(pickRecord(item.video)?.duration) ??
      null,
    views:
      asNumber(stats.play_count) ??
      asNumber(stats.playCount) ??
      asNumber(stats.views) ??
      asNumber(item.play_count) ??
      asNumber(item.views),
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
    const count = String(Math.min(30, Math.max(1, input.maxResults ?? 20)));

    // Try keyword search first; fall back to regional trending for empty queries.
    let body: Record<string, unknown>;
    try {
      body = await tiktokGet("/search/video", {
        keyword: input.query,
        count,
      });
    } catch {
      try {
        body = await tiktokGet("/video/search", {
          keyword: input.query,
          count,
        });
      } catch {
        body = await tiktokGet("/feed/trending", {
          region: "US",
          count,
        });
      }
    }

    const lookbackMs = (input.lookbackDays ?? 30) * 86_400_000;
    const cutoff = Date.now() - lookbackMs;

    return extractList(body)
      .map((raw) => normalizeTiktokVideo(raw, retrievedAt))
      .filter((post): post is SearchPostResult => Boolean(post))
      .filter((post) => (post.views ?? 0) >= (input.minViews ?? 0))
      .filter((post) => {
        if (!post.publishedAt) return true;
        const t = new Date(post.publishedAt).getTime();
        return Number.isFinite(t) ? t >= cutoff : true;
      })
      .map((post) => ({
        ...post,
        collectionMethod: "third_party_search",
      }))
      .slice(0, input.maxResults ?? 25);
  },

  async getCreatorPosts(input: CreatorPostsInput): Promise<SearchPostResult[]> {
    if (!isTiktokDataApiConfigured()) return [];
    if (input.platform !== "tiktok") return [];

    const retrievedAt = new Date().toISOString();
    const count = String(Math.min(30, Math.max(1, input.maxResults ?? 10)));
    const handle = input.platformCreatorId.replace(/^@/, "");

    let body: Record<string, unknown>;
    try {
      body = await tiktokGet("/user/posts", {
        unique_id: handle,
        count,
      });
    } catch {
      body = await tiktokGet("/user/videos", {
        unique_id: handle,
        count,
      });
    }

    return extractList(body)
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
