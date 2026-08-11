import type { ResearchVideoCandidate } from "./types";

type YoutubeError = {
  error?: { message?: string };
};

async function youtubeGet<T>(url: URL): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as T & YoutubeError;
  if (!response.ok || body.error) {
    throw new Error(
      body.error?.message ?? `YouTube Data API failed (${response.status})`,
    );
  }
  return body;
}

function numberOrNull(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function durationSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  return (
    Number(match[1] ?? 0) * 3600 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)
  );
}

export async function searchYoutubeResearch(params: {
  query: string;
  lookbackDays: number;
  maxResults: number;
}): Promise<ResearchVideoCandidate[]> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "YouTube Research Radar is not configured. Add YOUTUBE_DATA_API_KEY to .env.development.local.",
    );
  }

  const publishedAfter = new Date(
    Date.now() - params.lookbackDays * 86_400_000,
  ).toISOString();
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("videoEmbeddable", "true");
  // Niche discovery targets short-form; without this, long uploads dominate
  // and then get dropped by the short-form filter → empty results.
  searchUrl.searchParams.set("videoDuration", "short");
  searchUrl.searchParams.set("order", "viewCount");
  searchUrl.searchParams.set("q", params.query);
  searchUrl.searchParams.set("publishedAfter", publishedAfter);
  searchUrl.searchParams.set("maxResults", String(params.maxResults));

  const search = await youtubeGet<{
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        channelId?: string;
        channelTitle?: string;
        title?: string;
        description?: string;
        publishedAt?: string;
        thumbnails?: {
          high?: { url?: string };
          medium?: { url?: string };
          default?: { url?: string };
        };
      };
    }>;
  }>(searchUrl);

  const ids = (search.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];

  const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  detailsUrl.searchParams.set("key", apiKey);
  detailsUrl.searchParams.set("part", "snippet,statistics,contentDetails");
  detailsUrl.searchParams.set("id", ids.join(","));

  const details = await youtubeGet<{
    items?: Array<{
      id: string;
      snippet?: {
        channelId?: string;
        channelTitle?: string;
        title?: string;
        description?: string;
        publishedAt?: string;
        thumbnails?: {
          high?: { url?: string };
          medium?: { url?: string };
          default?: { url?: string };
        };
      };
      statistics?: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
      contentDetails?: { duration?: string };
    }>;
  }>(detailsUrl);

  return (details.items ?? []).map((item) => ({
    platform: "youtube" as const,
    externalId: item.id,
    externalUrl: `https://www.youtube.com/watch?v=${item.id}`,
    creatorId: item.snippet?.channelId ?? null,
    creatorName: item.snippet?.channelTitle ?? null,
    title: item.snippet?.title ?? null,
    description: item.snippet?.description ?? null,
    thumbnailUrl:
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      null,
    publishedAt: item.snippet?.publishedAt ?? null,
    durationSeconds: durationSeconds(item.contentDetails?.duration),
    views: numberOrNull(item.statistics?.viewCount),
    likes: numberOrNull(item.statistics?.likeCount),
    comments: numberOrNull(item.statistics?.commentCount),
    shares: null,
  }));
}

/** Recent public uploads for a channel (watchlist monitoring). */
export async function getYoutubeChannelPosts(params: {
  channelId: string;
  maxResults?: number;
}): Promise<ResearchVideoCandidate[]> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("YOUTUBE_DATA_API_KEY is not configured.");
  }

  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.searchParams.set("key", apiKey);
  channelUrl.searchParams.set("part", "contentDetails,snippet");
  channelUrl.searchParams.set("id", params.channelId);

  const channel = await youtubeGet<{
    items?: Array<{
      snippet?: { title?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  }>(channelUrl);

  const uploadsId =
    channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  const channelTitle = channel.items?.[0]?.snippet?.title ?? null;
  if (!uploadsId) return [];

  const playlistUrl = new URL(
    "https://www.googleapis.com/youtube/v3/playlistItems",
  );
  playlistUrl.searchParams.set("key", apiKey);
  playlistUrl.searchParams.set("part", "snippet,contentDetails");
  playlistUrl.searchParams.set("playlistId", uploadsId);
  playlistUrl.searchParams.set(
    "maxResults",
    // Oversample uploads so Shorts-length videos survive duration filtering.
    String(Math.min(50, Math.max(1, (params.maxResults ?? 10) * 3))),
  );

  const playlist = await youtubeGet<{
    items?: Array<{
      contentDetails?: { videoId?: string };
      snippet?: {
        title?: string;
        description?: string;
        publishedAt?: string;
        channelId?: string;
        channelTitle?: string;
        thumbnails?: {
          high?: { url?: string };
          medium?: { url?: string };
          default?: { url?: string };
        };
      };
    }>;
  }>(playlistUrl);

  const ids = (playlist.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];

  const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  detailsUrl.searchParams.set("key", apiKey);
  detailsUrl.searchParams.set("part", "snippet,statistics,contentDetails");
  detailsUrl.searchParams.set("id", ids.join(","));

  const details = await youtubeGet<{
    items?: Array<{
      id: string;
      snippet?: {
        channelId?: string;
        channelTitle?: string;
        title?: string;
        description?: string;
        publishedAt?: string;
        thumbnails?: {
          high?: { url?: string };
          medium?: { url?: string };
          default?: { url?: string };
        };
      };
      statistics?: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
      contentDetails?: { duration?: string };
    }>;
  }>(detailsUrl);

  const mapped = (details.items ?? []).map((item) => ({
    platform: "youtube" as const,
    externalId: item.id,
    externalUrl: `https://www.youtube.com/watch?v=${item.id}`,
    creatorId: item.snippet?.channelId ?? params.channelId,
    creatorName: item.snippet?.channelTitle ?? channelTitle,
    title: item.snippet?.title ?? null,
    description: item.snippet?.description ?? null,
    thumbnailUrl:
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      null,
    publishedAt: item.snippet?.publishedAt ?? null,
    durationSeconds: durationSeconds(item.contentDetails?.duration),
    views: numberOrNull(item.statistics?.viewCount),
    likes: numberOrNull(item.statistics?.likeCount),
    comments: numberOrNull(item.statistics?.commentCount),
    shares: null,
  }));

  // Prefer Shorts-length uploads (aligned with search videoDuration=short).
  const shorts = mapped.filter(
    (v) =>
      v.durationSeconds != null &&
      v.durationSeconds > 0 &&
      v.durationSeconds <= 240,
  );
  return (shorts.length > 0 ? shorts : mapped).slice(
    0,
    params.maxResults ?? 10,
  );
}

