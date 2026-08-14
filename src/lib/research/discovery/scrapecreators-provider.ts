import { compactDiscoveryQuery } from "../search-filters";
import type { ResearchPlatform } from "../types";
import {
  isScrapeCreatorsConfigured,
  scrapecreatorsGet,
} from "./scrapecreators-client";
import { normalizeTiktokVideo } from "./tiktok-data-provider";
import type {
  ContentDiscoveryProvider,
  CreatorPostsInput,
  DiscoveryCapabilities,
  SearchPostResult,
  SearchPostsInput,
} from "./types";
import { isYoutubeDiscoveryConfigured } from "./youtube-provider";

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

function asMediaUrl(value: unknown): string | null {
  const direct = asString(value);
  if (direct) return direct;
  const rec = pickRecord(value);
  if (!rec) return null;
  if (Array.isArray(rec.url_list) && rec.url_list.length > 0) {
    return asString(rec.url_list[0]);
  }
  const url = asString(rec.url);
  if (url) return url;
  // Instagram profile reels commonly nest covers under
  // image_versions2.candidates[0].url.
  if (Array.isArray(rec.candidates)) {
    for (const candidate of rec.candidates) {
      const candidateUrl = asMediaUrl(candidate);
      if (candidateUrl) return candidateUrl;
    }
  }
  return null;
}

function normalizePublishedAt(value: unknown): string | null {
  const numeric = asNumber(value);
  if (numeric != null && numeric > 1_000_000_000) {
    return new Date(
      numeric > 10_000_000_000 ? numeric : numeric * 1000,
    ).toISOString();
  }
  const text = asString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function scrapeCreatorsPlatforms(): ResearchPlatform[] {
  const platforms: ResearchPlatform[] = ["tiktok", "instagram"];
  if (!isYoutubeDiscoveryConfigured()) platforms.push("youtube");
  return platforms;
}

function tiktokDatePosted(lookbackDays: number): string {
  if (lookbackDays <= 1) return "yesterday";
  if (lookbackDays <= 7) return "this-week";
  if (lookbackDays <= 30) return "this-month";
  if (lookbackDays <= 90) return "last-3-months";
  return "last-6-months";
}

function instagramDatePosted(lookbackDays: number): string {
  if (lookbackDays <= 1) return "last-day";
  if (lookbackDays <= 7) return "last-week";
  if (lookbackDays <= 30) return "last-month";
  return "last-year";
}

function youtubeUploadDate(lookbackDays: number): string {
  if (lookbackDays <= 1) return "today";
  if (lookbackDays <= 7) return "this_week";
  if (lookbackDays <= 30) return "this_month";
  return "this_year";
}

function extractList(
  body: Record<string, unknown>,
  keys: string[],
): unknown[] {
  for (const key of keys) {
    const value = body[key];
    if (Array.isArray(value) && value.length > 0) return value;
  }
  const data = pickRecord(body.data);
  if (data) {
    for (const key of keys) {
      const value = data[key];
      if (Array.isArray(value) && value.length > 0) return value;
    }
  }
  return [];
}

export function normalizeInstagramReel(
  raw: unknown,
  retrievedAt: string,
): SearchPostResult | null {
  const outer = pickRecord(raw);
  if (!outer) return null;
  // The profile-reels endpoint wraps each reel in `{ media: ... }`, while the
  // search endpoint returns the reel directly. Normalize both contracts.
  const item = pickRecord(outer.media) ?? outer;
  const owner =
    pickRecord(item.owner) ??
    pickRecord(item.user) ??
    pickRecord(item.author) ??
    pickRecord(outer.owner) ??
    pickRecord(outer.user);
  const captionRec = pickRecord(item.caption);
  const shortcode =
    asString(item.shortcode) ?? asString(item.code) ?? asString(item.short_code);
  const id =
    shortcode ??
    asString(item.id) ??
    asString(item.pk) ??
    asString(item.media_id);
  if (!id) return null;

  const handle =
    asString(owner?.username) ??
    asString(item.username) ??
    asString(item.owner_username);
  const publishedAt =
    normalizePublishedAt(item.taken_at) ??
    normalizePublishedAt(item.taken_at_timestamp) ??
    normalizePublishedAt(item.published_at) ??
    normalizePublishedAt(outer.taken_at);

  const title =
    asString(item.caption) ??
    asString(captionRec?.text) ??
    asString(item.title);

  return {
    platform: "instagram",
    externalId: id,
    externalUrl:
      asString(item.url) ??
      (shortcode
        ? `https://www.instagram.com/reel/${shortcode}/`
        : `https://www.instagram.com/p/${id}/`),
    creatorId: asString(owner?.id) ?? asString(owner?.pk) ?? handle,
    creatorName: asString(owner?.full_name) ?? handle,
    title,
    description: title,
    thumbnailUrl:
      asString(item.thumbnail_url) ??
      asString(item.thumbnail_src) ??
      asString(item.display_url) ??
      asString(item.display_uri) ??
      asMediaUrl(item.image_versions2) ??
      asMediaUrl(item.cover),
    publishedAt,
    durationSeconds:
      asNumber(item.video_duration) ?? asNumber(item.duration) ?? null,
    views:
      asNumber(item.video_play_count) ??
      asNumber(item.play_count) ??
      asNumber(item.ig_play_count) ??
      asNumber(item.video_view_count),
    likes: asNumber(item.like_count) ?? asNumber(item.likes),
    comments: asNumber(item.comment_count) ?? asNumber(item.comments),
    shares: null,
    providerName: "scrapecreators",
    collectionMethod: "third_party_search",
    retrievedAt,
    creatorFollowerCount: asNumber(owner?.follower_count) ?? null,
  };
}

export function normalizeYoutubeSearchItem(
  raw: unknown,
  retrievedAt: string,
): SearchPostResult | null {
  const item = pickRecord(raw);
  if (!item) return null;
  const channel = pickRecord(item.channel);
  const id = asString(item.id) ?? asString(item.videoId);
  if (!id) return null;
  const handle =
    asString(channel?.handle)?.replace(/^@/, "") ??
    asString(channel?.title) ??
    null;

  return {
    platform: "youtube",
    externalId: id,
    externalUrl:
      asString(item.url) ?? `https://www.youtube.com/shorts/${id}`,
    creatorId: asString(channel?.id) ?? handle,
    creatorName: asString(channel?.title) ?? handle,
    title: asString(item.title),
    description: asString(item.title),
    thumbnailUrl: asString(item.thumbnail) ?? asString(item.thumbnailUrl),
    publishedAt:
      asString(item.publishedTime) ?? asString(item.publishedAt) ?? null,
    durationSeconds:
      asNumber(item.lengthSeconds) ?? asNumber(item.durationSeconds),
    views: asNumber(item.viewCountInt) ?? asNumber(item.views),
    likes: asNumber(item.likeCount) ?? asNumber(item.likes),
    comments: asNumber(item.commentCount) ?? asNumber(item.comments),
    shares: null,
    providerName: "scrapecreators",
    collectionMethod: "third_party_search",
    retrievedAt,
    creatorFollowerCount: null,
  };
}

async function searchTiktok(params: {
  query: string;
  lookbackDays: number;
  maxResults: number;
  minViews: number;
  retrievedAt: string;
}): Promise<SearchPostResult[]> {
  const q = compactDiscoveryQuery(params.query);
  const posts: SearchPostResult[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 2 && posts.length < params.maxResults; page++) {
    const body = await scrapecreatorsGet("/v1/tiktok/search/keyword", {
      query: q,
      date_posted: tiktokDatePosted(params.lookbackDays),
      sort_by: "relevance",
      trim: true,
      ...(cursor ? { cursor } : {}),
    });
    const items = extractList(body, [
      "search_item_list",
      "aweme_list",
      "videos",
    ]);
    for (const raw of items) {
      const post = normalizeTiktokVideo(raw, params.retrievedAt);
      if (!post) continue;
      if (post.views != null && post.views < params.minViews) continue;
      posts.push({
        ...post,
        providerName: "scrapecreators",
        collectionMethod: "third_party_search",
      });
    }
    const next = body.cursor;
    if (next == null || String(next) === cursor) break;
    cursor = String(next);
    if (items.length === 0) break;
  }
  return dedupe(posts).slice(0, params.maxResults);
}

async function searchInstagram(params: {
  query: string;
  lookbackDays: number;
  maxResults: number;
  minViews: number;
  retrievedAt: string;
}): Promise<SearchPostResult[]> {
  const q = compactDiscoveryQuery(params.query);
  // Docs allow pages 1–11; each page costs 1 credit. Pull enough to fill
  // maxResults, then widen the date window once if the niche is sparse.
  const maxPages =
    params.lookbackDays <= 2
      ? 2
      : Math.min(11, Math.max(3, Math.ceil(params.maxResults / 8)));
  const posts: SearchPostResult[] = [];

  const pullPages = async (datePosted: string | undefined) => {
    for (let page = 1; page <= maxPages && posts.length < params.maxResults; page++) {
      const body = await scrapecreatorsGet("/v2/instagram/reels/search", {
        query: q,
        ...(datePosted ? { date_posted: datePosted } : {}),
        page,
      });
      const items = extractList(body, ["reels", "items"]);
      if (items.length === 0) break;
      for (const raw of items) {
        const post = normalizeInstagramReel(raw, params.retrievedAt);
        if (!post) continue;
        if (post.views != null && post.views < params.minViews) continue;
        posts.push(post);
      }
    }
  };

  await pullPages(instagramDatePosted(params.lookbackDays));
  // Niche keywords often return few Google-indexed reels in a short window.
  // Incremental visit refreshes stay in the requested window so we don't
  // spend credits re-pulling last year's catalog.
  if (
    posts.length < Math.min(8, params.maxResults) &&
    params.lookbackDays >= 14
  ) {
    await pullPages(
      params.lookbackDays < 365 ? "last-year" : undefined,
    );
  }
  return dedupe(posts).slice(0, params.maxResults);
}

async function searchYoutube(params: {
  query: string;
  lookbackDays: number;
  maxResults: number;
  minViews: number;
  retrievedAt: string;
}): Promise<SearchPostResult[]> {
  const body = await scrapecreatorsGet("/v1/youtube/search", {
    query: compactDiscoveryQuery(params.query, 6),
    type: "shorts",
    uploadDate: youtubeUploadDate(params.lookbackDays),
    sortBy: "relevance",
  });
  const items = [
    ...extractList(body, ["shorts"]),
    ...extractList(body, ["videos"]),
  ];
  return dedupe(
    items
      .map((raw) => normalizeYoutubeSearchItem(raw, params.retrievedAt))
      .filter((post): post is SearchPostResult => Boolean(post))
      .filter((post) => post.views == null || post.views >= params.minViews),
  ).slice(0, params.maxResults);
}

function dedupe(posts: SearchPostResult[]): SearchPostResult[] {
  const seen = new Set<string>();
  const out: SearchPostResult[] = [];
  for (const post of posts) {
    const key = `${post.platform}:${post.externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(post);
  }
  return out;
}

function isInsideRollingWindow(
  post: SearchPostResult,
  lookbackDays: number,
  now = Date.now(),
): boolean {
  if (!post.publishedAt) return true;
  const publishedAt = new Date(post.publishedAt).getTime();
  if (!Number.isFinite(publishedAt)) return false;
  return publishedAt >= now - lookbackDays * 86_400_000;
}

function pageIsOlderThanWindow(
  posts: SearchPostResult[],
  lookbackDays: number,
  now = Date.now(),
): boolean {
  const dated = posts
    .map((post) =>
      post.publishedAt ? new Date(post.publishedAt).getTime() : Number.NaN,
    )
    .filter(Number.isFinite);
  return (
    dated.length > 0 &&
    dated.every((publishedAt) => publishedAt < now - lookbackDays * 86_400_000)
  );
}

function instagramPaging(body: Record<string, unknown>): {
  maxId: string | null;
  moreAvailable: boolean;
} {
  const data = pickRecord(body.data);
  const paging = pickRecord(body.paging_info) ?? pickRecord(data?.paging_info);
  return {
    maxId: asString(paging?.max_id),
    moreAvailable:
      paging?.more_available === true || asNumber(paging?.more_available) === 1,
  };
}

export const scrapeCreatorsDiscoveryProvider: ContentDiscoveryProvider = {
  providerName: "scrapecreators",

  capabilities(): DiscoveryCapabilities {
    const configured = isScrapeCreatorsConfigured();
    return {
      searchPosts: configured,
      searchCreators: false,
      getCreatorPosts: configured,
      refreshMetrics: false,
      getCreatorBaseline: false,
      platforms: configured ? scrapeCreatorsPlatforms() : [],
      providerType: "third_party",
    };
  },

  async searchPosts(input: SearchPostsInput): Promise<SearchPostResult[]> {
    if (!isScrapeCreatorsConfigured()) return [];
    const retrievedAt = new Date().toISOString();
    const maxResults = input.maxResults ?? 25;
    const minViews = input.minViews ?? 0;
    const lookbackDays = input.lookbackDays ?? 30;
    const wanted = new Set(
      (input.platforms?.length
        ? input.platforms
        : scrapeCreatorsPlatforms()
      ).filter((p) => scrapeCreatorsPlatforms().includes(p)),
    );

    const tasks: Array<Promise<SearchPostResult[]>> = [];
    if (wanted.has("tiktok")) {
      tasks.push(
        searchTiktok({
          query: input.query,
          lookbackDays,
          maxResults,
          minViews,
          retrievedAt,
        }),
      );
    }
    if (wanted.has("instagram")) {
      tasks.push(
        searchInstagram({
          query: input.query,
          lookbackDays,
          maxResults,
          minViews,
          retrievedAt,
        }),
      );
    }
    if (wanted.has("youtube") && !isYoutubeDiscoveryConfigured()) {
      tasks.push(
        searchYoutube({
          query: input.query,
          lookbackDays,
          maxResults,
          minViews,
          retrievedAt,
        }),
      );
    }

    const settled = await Promise.allSettled(tasks);
    const posts: SearchPostResult[] = [];
    const errors: string[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") posts.push(...result.value);
      else {
        errors.push(
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
        );
      }
    }
    if (posts.length === 0 && errors.length > 0) {
      throw new Error(errors.join(" · "));
    }
    return posts;
  },

  async getCreatorPosts(input: CreatorPostsInput): Promise<SearchPostResult[]> {
    if (!isScrapeCreatorsConfigured()) return [];
    const retrievedAt = new Date().toISOString();
    const identity = input.platformCreatorId.replace(/^@/, "");
    const maxResults = Math.min(500, Math.max(1, input.maxResults ?? 10));
    const lookbackDays = Math.min(365, Math.max(1, input.lookbackDays ?? 30));
    const maxPages = Math.min(25, Math.max(1, input.maxPages ?? 1));

    if (input.platform === "tiktok") {
      const posts: SearchPostResult[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < maxPages && posts.length < maxResults; page++) {
        const body = await scrapecreatorsGet("/v3/tiktok/profile/videos", {
          ...(/^\d+$/.test(identity)
            ? { user_id: identity }
            : { handle: identity }),
          sort_by: "latest",
          trim: true,
          ...(cursor ? { max_cursor: cursor } : {}),
        });
        const pagePosts = extractList(body, [
          "aweme_list",
          "videos",
          "search_item_list",
        ])
          .map((raw) => normalizeTiktokVideo(raw, retrievedAt))
          .filter((post): post is SearchPostResult => Boolean(post))
          .map((post) => ({
            ...post,
            providerName: "scrapecreators",
            collectionMethod: "third_party_creator_posts",
            creatorId: post.creatorId ?? identity,
          }));
        posts.push(...pagePosts);
        if (pagePosts.length === 0 || pageIsOlderThanWindow(pagePosts, lookbackDays)) {
          break;
        }
        const nextCursor = asString(body.max_cursor) ?? asString(body.cursor);
        const hasMore = asNumber(body.has_more) === 1 || body.has_more === true;
        if (!hasMore || !nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
      }
      return dedupe(posts)
        .filter((post) => isInsideRollingWindow(post, lookbackDays))
        .slice(0, maxResults);
    }

    if (input.platform === "instagram") {
      const posts: SearchPostResult[] = [];
      let maxId: string | null = null;
      for (let page = 0; page < maxPages && posts.length < maxResults; page++) {
        const body = await scrapecreatorsGet("/v1/instagram/user/reels", {
          ...(/^\d+$/.test(identity)
            ? { user_id: identity }
            : { handle: identity }),
          trim: true,
          ...(maxId ? { max_id: maxId } : {}),
        });
        const pagePosts = extractList(body, ["items", "reels"])
          .map((raw) => normalizeInstagramReel(raw, retrievedAt))
          .filter((post): post is SearchPostResult => Boolean(post))
          .map((post) => ({
            ...post,
            collectionMethod: "third_party_creator_posts",
            creatorId: post.creatorId ?? identity,
          }));
        posts.push(...pagePosts);
        if (pagePosts.length === 0 || pageIsOlderThanWindow(pagePosts, lookbackDays)) {
          break;
        }
        const paging = instagramPaging(body);
        if (!paging.moreAvailable || !paging.maxId || paging.maxId === maxId) break;
        maxId = paging.maxId;
      }
      return dedupe(posts)
        .filter((post) => isInsideRollingWindow(post, lookbackDays))
        .slice(0, maxResults);
    }

    if (input.platform === "youtube" && !isYoutubeDiscoveryConfigured()) {
      const idParam = /^UC[\w-]{20,}$/i.test(identity)
        ? { channelId: identity }
        : { handle: identity };
      const body = await scrapecreatorsGet(
        "/v1/youtube/channel/shorts",
        idParam,
      );
      return extractList(body, ["shorts", "videos", "items"])
        .map((raw) => normalizeYoutubeSearchItem(raw, retrievedAt))
        .filter((post): post is SearchPostResult => Boolean(post))
        .map((post) => ({
          ...post,
          collectionMethod: "third_party_creator_posts",
        }))
        .filter((post) => isInsideRollingWindow(post, lookbackDays))
        .slice(0, maxResults);
    }

    return [];
  },
};
