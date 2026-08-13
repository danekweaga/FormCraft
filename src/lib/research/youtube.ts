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

/** YouTube exposes a channel's self-declared ISO country in snippet.country. */
export function isExcludedYoutubeChannelCountry(
  country: string | null | undefined,
): boolean {
  return country?.trim().toUpperCase() === "IN";
}

async function getYoutubeChannelCountries(
  apiKey: string,
  channelIds: Array<string | undefined>,
): Promise<Map<string, string | null>> {
  const ids = Array.from(
    new Set(channelIds.filter((id): id is string => Boolean(id))),
  );
  if (ids.length === 0) return new Map();

  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", ids.join(","));

  const response = await youtubeGet<{
    items?: Array<{ id: string; snippet?: { country?: string } }>;
  }>(url);
  return new Map(
    (response.items ?? []).map((channel) => [
      channel.id,
      channel.snippet?.country ?? null,
    ]),
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
  // Relevance, not raw viewCount — viewCount+short was returning junk spam.
  searchUrl.searchParams.set("order", "relevance");
  searchUrl.searchParams.set("q", params.query);
  // Bias broad discovery toward Nonso's English-speaking Canadian audience.
  // The strict ingestion gate still makes the final keep/drop decision.
  searchUrl.searchParams.set("relevanceLanguage", "en");
  searchUrl.searchParams.set("regionCode", "CA");
  searchUrl.searchParams.set("publishedAfter", publishedAfter);
  searchUrl.searchParams.set(
    "maxResults",
    String(Math.min(50, Math.max(1, params.maxResults))),
  );

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

  const channelCountries = await getYoutubeChannelCountries(
    apiKey,
    (details.items ?? []).map((item) => item.snippet?.channelId),
  );

  return (details.items ?? [])
    .filter(
      (item) =>
        !isExcludedYoutubeChannelCountry(
          channelCountries.get(item.snippet?.channelId ?? ""),
        ),
    )
    .map((item) => ({
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
  lookbackDays?: number;
  maxPages?: number;
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
      snippet?: { title?: string; country?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  }>(channelUrl);

  if (isExcludedYoutubeChannelCountry(channel.items?.[0]?.snippet?.country)) {
    return [];
  }

  const uploadsId =
    channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  const channelTitle = channel.items?.[0]?.snippet?.title ?? null;
  if (!uploadsId) return [];

  const maxResults = Math.min(500, Math.max(1, params.maxResults ?? 10));
  const lookbackDays = Math.min(365, Math.max(1, params.lookbackDays ?? 30));
  const cutoff = Date.now() - lookbackDays * 86_400_000;
  // Shorts can be mixed with long uploads. Walk enough upload pages to cover
  // the entire rolling window, then fetch video details in batches of 50.
  const maxUploads = Math.min(500, Math.max(50, maxResults * 3));
  const maxPages = Math.min(
    10,
    Math.max(1, params.maxPages ?? Math.ceil(maxUploads / 50)),
  );
  const playlistItems: Array<{
    contentDetails?: { videoId?: string };
    snippet?: { publishedAt?: string };
  }> = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages && playlistItems.length < maxUploads; page++) {
    const playlistUrl = new URL(
      "https://www.googleapis.com/youtube/v3/playlistItems",
    );
    playlistUrl.searchParams.set("key", apiKey);
    playlistUrl.searchParams.set("part", "snippet,contentDetails");
    playlistUrl.searchParams.set("playlistId", uploadsId);
    playlistUrl.searchParams.set("maxResults", "50");
    if (pageToken) playlistUrl.searchParams.set("pageToken", pageToken);

    const playlist = await youtubeGet<{
      items?: Array<{
        contentDetails?: { videoId?: string };
        snippet?: { publishedAt?: string };
      }>;
      nextPageToken?: string;
    }>(playlistUrl);
    const pageItems = playlist.items ?? [];
    playlistItems.push(...pageItems);
    const dated = pageItems
      .map((item) =>
        item.snippet?.publishedAt
          ? new Date(item.snippet.publishedAt).getTime()
          : Number.NaN,
      )
      .filter(Number.isFinite);
    if (dated.length > 0 && dated.every((publishedAt) => publishedAt < cutoff)) {
      break;
    }
    if (!playlist.nextPageToken || pageItems.length === 0) break;
    pageToken = playlist.nextPageToken;
  }

  const ids = Array.from(
    new Set(
      playlistItems
        .map((item) => item.contentDetails?.videoId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (ids.length === 0) return [];

  type YoutubeVideoDetails = {
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
  };
  const detailBatches: YoutubeVideoDetails[] = [];
  for (let index = 0; index < ids.length; index += 50) {
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("key", apiKey);
    detailsUrl.searchParams.set("part", "snippet,statistics,contentDetails");
    detailsUrl.searchParams.set("id", ids.slice(index, index + 50).join(","));
    detailBatches.push(await youtubeGet<YoutubeVideoDetails>(detailsUrl));
  }

  const mapped = detailBatches.flatMap((details) => details.items ?? []).map((item) => ({
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
  })).filter((video) => {
    if (!video.publishedAt) return false;
    const publishedAt = new Date(video.publishedAt).getTime();
    return Number.isFinite(publishedAt) && publishedAt >= cutoff;
  });

  // Prefer Shorts-length uploads (aligned with search videoDuration=short).
  const shorts = mapped.filter(
    (v) =>
      v.durationSeconds != null &&
      v.durationSeconds > 0 &&
      v.durationSeconds <= 240,
  );
  return (shorts.length > 0 ? shorts : mapped).slice(
    0,
    maxResults,
  );
}
