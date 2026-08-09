import {
  getOAuthCallbackUrl,
  isPlatformConfigured,
  platformUnconfiguredReason,
  REQUESTED_SCOPES,
  youtubeConfig,
} from "../config";
import type {
  AuthorizationParams,
  CallbackParams,
  ConnectionResult,
  OwnedPost,
  OwnedProfile,
  OwnedSocialProvider,
  PostMetrics,
  TokenBundle,
  TokenResult,
} from "../types";

async function googleTokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description ?? json.error ?? "Google token request failed",
    );
  }
  return json;
}

async function ytGet<T>(
  url: string,
  accessToken: string,
): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as T & {
    error?: { message?: string };
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `YouTube API error (${res.status})`);
  }
  return json;
}

export const youtubeOwnedProvider: OwnedSocialProvider = {
  platform: "youtube",
  displayName: "YouTube",
  capabilities: {
    profile: true,
    posts: true,
    postMetrics: true,
    comments: false,
    retention: false,
    audienceInsights: false,
    channelAnalytics: true,
  },

  isConfigured() {
    return isPlatformConfigured("youtube");
  },

  unconfiguredReason() {
    return platformUnconfiguredReason("youtube");
  },

  async getAuthorizationUrl(params: AuthorizationParams) {
    const { clientId } = youtubeConfig();
    if (!clientId) throw new Error(this.unconfiguredReason()!);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", REQUESTED_SCOPES.youtube.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", params.state);
    if (params.codeChallenge) {
      url.searchParams.set("code_challenge", params.codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  },

  async handleCallback(params: CallbackParams): Promise<ConnectionResult> {
    const { clientId, clientSecret } = youtubeConfig();
    if (!clientId || !clientSecret) throw new Error(this.unconfiguredReason()!);

    const tokenJson = await googleTokenRequest({
      code: params.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
      ...(params.codeVerifier ? { code_verifier: params.codeVerifier } : {}),
    });

    const tokens: TokenBundle = {
      accessToken: tokenJson.access_token!,
      refreshToken: tokenJson.refresh_token ?? null,
      expiresAt: tokenJson.expires_in
        ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
        : null,
      scopes: tokenJson.scope?.split(/\s+/) ?? [...REQUESTED_SCOPES.youtube],
      metadata: { provider: "youtube" },
    };

    const profile = await this.getProfile(tokens);
    return { profile, tokens };
  },

  async refreshAuthorization(tokens: TokenBundle): Promise<TokenResult> {
    const { clientId, clientSecret } = youtubeConfig();
    if (!clientId || !clientSecret) throw new Error(this.unconfiguredReason()!);
    if (!tokens.refreshToken) {
      throw new Error("YouTube refresh token missing — reconnect the account");
    }
    const json = await googleTokenRequest({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    });
    return {
      ...tokens,
      accessToken: json.access_token!,
      expiresAt: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : tokens.expiresAt,
      scopes: json.scope?.split(/\s+/) ?? tokens.scopes,
    };
  },

  async revokeAuthorization(tokens: TokenBundle) {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.accessToken)}`,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
  },

  async getProfile(tokens: TokenBundle): Promise<OwnedProfile> {
    const data = await ytGet<{
      items?: Array<{
        id: string;
        snippet?: {
          title?: string;
          customUrl?: string;
          thumbnails?: { default?: { url?: string } };
        };
        statistics?: { subscriberCount?: string; videoCount?: string };
      }>;
    }>(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      tokens.accessToken,
    );

    const channel = data.items?.[0];
    if (!channel) {
      throw new Error("No owned YouTube channel found for this Google account");
    }

    const subscribers = channel.statistics?.subscriberCount
      ? Number(channel.statistics.subscriberCount)
      : null;

    return {
      platformAccountId: channel.id,
      username: channel.snippet?.customUrl ?? null,
      displayName: channel.snippet?.title ?? null,
      avatarUrl: channel.snippet?.thumbnails?.default?.url ?? null,
      followerCount: Number.isFinite(subscribers) ? subscribers : null,
      metadata: {
        videoCount: channel.statistics?.videoCount
          ? Number(channel.statistics.videoCount)
          : null,
      },
    };
  },

  async getPosts(tokens, options) {
    const channel = await this.getProfile(tokens);
    const uploadsSearch = await ytGet<{
      items?: Array<{
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
      }>;
    }>(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channel.platformAccountId)}`,
      tokens.accessToken,
    );
    const uploadsId =
      uploadsSearch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) return { posts: [], nextCursor: null };

    const playlistUrl = new URL(
      "https://www.googleapis.com/youtube/v3/playlistItems",
    );
    playlistUrl.searchParams.set("part", "snippet,contentDetails");
    playlistUrl.searchParams.set("playlistId", uploadsId);
    playlistUrl.searchParams.set("maxResults", String(options?.limit ?? 25));
    if (options?.cursor) playlistUrl.searchParams.set("pageToken", options.cursor);

    const page = await ytGet<{
      items?: Array<{
        contentDetails?: { videoId?: string };
        snippet?: {
          title?: string;
          description?: string;
          publishedAt?: string;
          thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
        };
      }>;
      nextPageToken?: string;
    }>(playlistUrl.toString(), tokens.accessToken);

    const videoIds = (page.items ?? [])
      .map((i) => i.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id));

    let durationById = new Map<string, number | null>();
    let statsById = new Map<
      string,
      { views: number | null; likes: number | null; comments: number | null }
    >();

    if (videoIds.length > 0) {
      const details = await ytGet<{
        items?: Array<{
          id: string;
          contentDetails?: { duration?: string };
          statistics?: {
            viewCount?: string;
            likeCount?: string;
            commentCount?: string;
          };
        }>;
      }>(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds.map(encodeURIComponent).join(",")}`,
        tokens.accessToken,
      );
      durationById = new Map(
        (details.items ?? []).map((v) => [
          v.id,
          parseIso8601Duration(v.contentDetails?.duration),
        ]),
      );
      statsById = new Map(
        (details.items ?? []).map((v) => [
          v.id,
          {
            views: numOrNull(v.statistics?.viewCount),
            likes: numOrNull(v.statistics?.likeCount),
            comments: numOrNull(v.statistics?.commentCount),
          },
        ]),
      );
    }

    const posts: OwnedPost[] = [];
    for (const item of page.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (!id) continue;
      const stats = statsById.get(id);
      posts.push({
        platformPostId: id,
        url: `https://www.youtube.com/watch?v=${id}`,
        caption: item.snippet?.description ?? null,
        title: item.snippet?.title ?? null,
        publishedAt: item.snippet?.publishedAt ?? null,
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          null,
        durationSeconds: durationById.get(id) ?? null,
        format: "video",
        raw: {
          dataApiStats: stats ?? null,
          note: "Public Data API stats; Analytics API used separately when scoped",
        },
      });
    }

    return { posts, nextCursor: page.nextPageToken ?? null };
  },

  async getPostMetrics(tokens, postIds): Promise<PostMetrics[]> {
    // Data API public statistics (separate from Analytics API)
    if (postIds.length === 0) return [];
    const details = await ytGet<{
      items?: Array<{
        id: string;
        statistics?: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
        };
      }>;
    }>(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${postIds.map(encodeURIComponent).join(",")}`,
      tokens.accessToken,
    );

    const byId = new Map((details.items ?? []).map((v) => [v.id, v.statistics]));
    const analytics = await tryYoutubeAnalytics(tokens, postIds);

    return postIds.map((id) => {
      const stats = byId.get(id);
      const analytic = analytics.get(id);
      return {
        platformPostId: id,
        views: analytic?.views ?? numOrNull(stats?.viewCount),
        reach: null,
        likes: numOrNull(stats?.likeCount),
        comments: numOrNull(stats?.commentCount),
        shares: null,
        saves: null,
        followersGained: null,
        watchTimeSeconds: analytic?.watchTimeSeconds ?? null,
        averageViewDurationSeconds: analytic?.averageViewDurationSeconds ?? null,
        completionRate: null,
        profileVisits: null,
        linkClicks: null,
        raw: {
          source: analytic ? "data_api+analytics_api" : "data_api",
        },
      };
    });
  },
};

async function tryYoutubeAnalytics(
  tokens: TokenBundle,
  videoIds: string[],
): Promise<
  Map<
    string,
    {
      views: number | null;
      watchTimeSeconds: number | null;
      averageViewDurationSeconds: number | null;
    }
  >
> {
  const out = new Map<
    string,
    {
      views: number | null;
      watchTimeSeconds: number | null;
      averageViewDurationSeconds: number | null;
    }
  >();

  // Analytics API requires channel report + video filter; skip quietly if unauthorized
  try {
    const channel = await ytGet<{ items?: Array<{ id: string }> }>(
      "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
      tokens.accessToken,
    );
    const channelId = channel.items?.[0]?.id;
    if (!channelId) return out;

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 90);

    for (const videoId of videoIds.slice(0, 20)) {
      const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
      url.searchParams.set("ids", `channel==${channelId}`);
      url.searchParams.set("startDate", start.toISOString().slice(0, 10));
      url.searchParams.set("endDate", end.toISOString().slice(0, 10));
      url.searchParams.set(
        "metrics",
        "views,estimatedMinutesWatched,averageViewDuration",
      );
      url.searchParams.set("filters", `video==${videoId}`);
      const report = await ytGet<{
        rows?: Array<[number, number, number]>;
      }>(url.toString(), tokens.accessToken);
      const row = report.rows?.[0];
      if (!row) continue;
      out.set(videoId, {
        views: typeof row[0] === "number" ? row[0] : null,
        watchTimeSeconds:
          typeof row[1] === "number" ? Math.round(row[1] * 60) : null,
        averageViewDurationSeconds: typeof row[2] === "number" ? row[2] : null,
      });
    }
  } catch {
    // Keep Data API-only metrics; do not invent Analytics values
  }

  return out;
}

function numOrNull(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseIso8601Duration(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function youtubeAuthorizeRedirectUri() {
  return getOAuthCallbackUrl("youtube");
}
