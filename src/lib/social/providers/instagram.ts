import {
  getOAuthCallbackUrl,
  instagramConfig,
  isPlatformConfigured,
  platformUnconfiguredReason,
  REQUESTED_SCOPES,
} from "../config";
import type {
  AuthorizationParams,
  CallbackParams,
  ConnectionResult,
  InstagramAccountInsightDay,
  InstagramAccountInsights,
  InstagramInsightBreakdown,
  OwnedPost,
  OwnedProfile,
  OwnedSocialProvider,
  PostMetrics,
  TokenBundle,
  TokenResult,
} from "../types";

type InsightBreakdownResult = {
  dimension_values?: string[];
  value?: number;
};

type InsightRow = {
  name: string;
  values?: Array<{ value?: number; end_time?: string }>;
  total_value?: {
    value?: number;
    breakdowns?: Array<{ results?: InsightBreakdownResult[] }>;
  };
};

type InsightResponse = { data?: InsightRow[] };

const COMMON_MEDIA_METRICS =
  "views,reach,likes,comments,shares,saved,total_interactions";
const REEL_MEDIA_METRICS =
  "ig_reels_avg_watch_time,ig_reels_video_view_total_time,reels_skip_rate";
const NON_REEL_ATTRIBUTION_METRICS =
  "profile_visits,follows,profile_activity";

const ACCOUNT_TOTAL_METRICS = [
  "views",
  "reach",
  "profile_views",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "replies",
  "profile_links_taps",
] as const;

function metricNumber(
  map: ReadonlyMap<string, number | null>,
  name: string,
): number | null {
  const value = map.get(name);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mergeInsightRows(
  map: Map<string, number | null>,
  rows: InsightRow[] | undefined,
) {
  for (const row of rows ?? []) {
    const value = row.total_value?.value ?? row.values?.[0]?.value;
    map.set(
      row.name,
      typeof value === "number" && Number.isFinite(value) ? value : null,
    );
  }
}

export function mapInstagramPostMetrics(
  platformPostId: string,
  map: ReadonlyMap<string, number | null>,
): PostMetrics {
  const watchMs = metricNumber(map, "ig_reels_video_view_total_time");
  const averageWatchMs = metricNumber(map, "ig_reels_avg_watch_time");

  return {
    platformPostId,
    views: metricNumber(map, "views"),
    reach: metricNumber(map, "reach"),
    likes: metricNumber(map, "likes"),
    comments: metricNumber(map, "comments"),
    shares: metricNumber(map, "shares"),
    saves: metricNumber(map, "saved"),
    followersGained: metricNumber(map, "follows"),
    watchTimeSeconds: watchMs === null ? null : watchMs / 1000,
    averageViewDurationSeconds:
      averageWatchMs === null ? null : averageWatchMs / 1000,
    // Meta exposes a 3-second skip rate for reels, not a completion rate.
    completionRate: null,
    profileVisits: metricNumber(map, "profile_visits"),
    linkClicks: null,
    extra: {
      total_interactions: metricNumber(map, "total_interactions"),
      profile_activity: metricNumber(map, "profile_activity"),
      reels_skip_rate: metricNumber(map, "reels_skip_rate"),
    },
  };
}

function breakdownValues(row: InsightRow | undefined): InstagramInsightBreakdown[] {
  const results = row?.total_value?.breakdowns?.[0]?.results ?? [];
  return results.flatMap((result) => {
    const label = result.dimension_values?.[0];
    return label && typeof result.value === "number"
      ? [{ label, value: result.value }]
      : [];
  });
}

/** Instagram Login authorize URL. force_reauth is required after Facebook invalidates a session. */
export function buildInstagramAuthorizationUrl(params: {
  appId: string;
  redirectUri: string;
  state: string;
  scopes: readonly string[];
  configId?: string | null;
  forceReauth?: boolean;
}): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", params.appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", params.state);
  url.searchParams.set(
    "force_reauth",
    params.forceReauth === false ? "false" : "true",
  );
  if (params.configId) {
    url.searchParams.set("config_id", params.configId);
  } else {
    url.searchParams.set("scope", params.scopes.join(","));
  }
  return url.toString();
}

async function graphGet<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<T> {
  const { graphVersion } = instagramConfig();
  const url = new URL(`https://graph.instagram.com/${graphVersion}${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Instagram API error (${res.status})`);
  }
  return json;
}

export const instagramOwnedProvider: OwnedSocialProvider = {
  platform: "instagram",
  displayName: "Instagram",
  capabilities: {
    profile: true,
    posts: true,
    postMetrics: true,
    comments: false,
    retention: false,
    audienceInsights: true,
    channelAnalytics: true,
  },

  isConfigured() {
    return isPlatformConfigured("instagram");
  },

  unconfiguredReason() {
    return platformUnconfiguredReason("instagram");
  },

  async getAuthorizationUrl(params: AuthorizationParams) {
    const { appId, configId } = instagramConfig();
    if (!appId) throw new Error(this.unconfiguredReason()!);
    return buildInstagramAuthorizationUrl({
      appId,
      redirectUri: params.redirectUri,
      state: params.state,
      scopes: REQUESTED_SCOPES.instagram,
      configId,
      forceReauth: true,
    });
  },

  async handleCallback(params: CallbackParams): Promise<ConnectionResult> {
    const { appId, appSecret, graphVersion } = instagramConfig();
    if (!appId || !appSecret) throw new Error(this.unconfiguredReason()!);

    const form = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: params.redirectUri,
      code: params.code,
    });

    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const shortJson = (await shortRes.json()) as {
      access_token?: string;
      user_id?: string | number;
      permissions?: string[];
      error_message?: string;
      error_type?: string;
    };
    if (!shortRes.ok || !shortJson.access_token) {
      throw new Error(
        shortJson.error_message ?? "Instagram authorization code exchange failed",
      );
    }

    const longUrl = new URL(
      `https://graph.instagram.com/${graphVersion}/access_token`,
    );
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("access_token", shortJson.access_token);
    const longRes = await fetch(longUrl);
    const longJson = (await longRes.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };
    if (!longRes.ok || !longJson.access_token) {
      throw new Error(
        longJson.error?.message ?? "Instagram long-lived token exchange failed",
      );
    }

    const tokens: TokenBundle = {
      accessToken: longJson.access_token,
      refreshToken: null,
      expiresAt: longJson.expires_in
        ? new Date(Date.now() + longJson.expires_in * 1000).toISOString()
        : null,
      scopes: shortJson.permissions ?? [...REQUESTED_SCOPES.instagram],
      metadata: {
        provider: "instagram",
        shortLivedUserId: shortJson.user_id,
      },
    };

    const profile = await this.getProfile(tokens);
    return { profile, tokens };
  },

  async refreshAuthorization(tokens: TokenBundle): Promise<TokenResult> {
    const { graphVersion } = instagramConfig();
    const url = new URL(
      `https://graph.instagram.com/${graphVersion}/refresh_access_token`,
    );
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", tokens.accessToken);
    const res = await fetch(url);
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };
    if (!res.ok || !json.access_token) {
      throw new Error(json.error?.message ?? "Instagram token refresh failed");
    }
    return {
      ...tokens,
      accessToken: json.access_token,
      expiresAt: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : tokens.expiresAt,
    };
  },

  async getProfile(tokens: TokenBundle): Promise<OwnedProfile> {
    const me = await graphGet<{
      id: string;
      username?: string;
      name?: string;
      profile_picture_url?: string;
      followers_count?: number;
      account_type?: string;
    }>("/me", tokens.accessToken, {
      fields: "id,username,name,profile_picture_url,followers_count,account_type",
    });

    return {
      platformAccountId: me.id,
      username: me.username ?? null,
      displayName: me.name ?? me.username ?? null,
      avatarUrl: me.profile_picture_url ?? null,
      followerCount:
        typeof me.followers_count === "number" ? me.followers_count : null,
      metadata: {
        account_type: me.account_type,
        note:
          "Instagram professional accounts only. Personal accounts are not supported by this API.",
      },
    };
  },

  async getPosts(tokens, options) {
    const limit = String(options?.limit ?? 25);
    const params: Record<string, string> = {
      fields:
        "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username,children{id,media_type,media_url,thumbnail_url}",
      limit,
    };
    if (options?.cursor) params.after = options.cursor;

    const page = await graphGet<{
      data?: Array<{
        id: string;
        caption?: string;
        media_type?: string;
        media_url?: string;
        permalink?: string;
        thumbnail_url?: string;
        timestamp?: string;
      }>;
      paging?: { cursors?: { after?: string } };
    }>("/me/media", tokens.accessToken, params);

    const posts: OwnedPost[] = (page.data ?? []).map((item) => ({
      platformPostId: item.id,
      url: item.permalink ?? null,
      caption: item.caption ?? null,
      title: item.caption?.slice(0, 120) ?? null,
      publishedAt: item.timestamp ?? null,
      thumbnailUrl: item.thumbnail_url ?? item.media_url ?? null,
      durationSeconds: null,
      format: item.media_type?.toLowerCase() ?? null,
      raw: { media_type: item.media_type },
    }));

    return {
      posts,
      nextCursor: page.paging?.cursors?.after ?? null,
    };
  },

  async getPostMetrics(tokens, postIds, options): Promise<PostMetrics[]> {
    const results: PostMetrics[] = [];

    for (const id of postIds) {
      try {
        const map = new Map<string, number | null>();
        const mergeInsights = async (metric: string) => {
          try {
            const insights = await graphGet<InsightResponse>(
              `/${id}/insights`,
              tokens.accessToken,
              { metric },
            );
            mergeInsightRows(map, insights.data);
          } catch {
            // Unsupported metric sets for this media type are skipped
          }
        };

        await mergeInsights(COMMON_MEDIA_METRICS);
        const mediaType = options?.mediaTypes?.[id]?.toLowerCase() ?? null;
        if (mediaType === "video") {
          await mergeInsights(REEL_MEDIA_METRICS);
        } else if (mediaType) {
          await mergeInsights(NON_REEL_ATTRIBUTION_METRICS);
        } else {
          await mergeInsights(REEL_MEDIA_METRICS);
          await mergeInsights(NON_REEL_ATTRIBUTION_METRICS);
        }

        results.push(mapInstagramPostMetrics(id, map));
      } catch {
        // Insights may be unavailable for some media types / ages — leave nulls
        results.push({
          platformPostId: id,
          views: null,
          reach: null,
          likes: null,
          comments: null,
          shares: null,
          saves: null,
          followersGained: null,
          watchTimeSeconds: null,
          averageViewDurationSeconds: null,
          completionRate: null,
          profileVisits: null,
          linkClicks: null,
        });
      }
    }

    return results;
  },

  async getAccountInsights(tokens): Promise<InstagramAccountInsights> {
    const profile = await graphGet<{ id: string }>("/me", tokens.accessToken, {
      fields: "id",
    });
    const rangeEnd = new Date();
    const rangeStart = new Date(rangeEnd.getTime() - 29 * 24 * 60 * 60 * 1000);
    const windowParams = {
      period: "day",
      since: String(Math.floor(rangeStart.getTime() / 1000)),
      until: String(Math.floor(rangeEnd.getTime() / 1000)),
    };

    const totalResponse = await graphGet<InsightResponse>(
      `/${profile.id}/insights`,
      tokens.accessToken,
      {
        ...windowParams,
        metric: ACCOUNT_TOTAL_METRICS.join(","),
        metric_type: "total_value",
      },
    );
    const totalMap = new Map<string, number | null>();
    mergeInsightRows(totalMap, totalResponse.data);

    const dailyResponse = await graphGet<InsightResponse>(
      `/${profile.id}/insights`,
      tokens.accessToken,
      { ...windowParams, metric: "reach,follower_count" },
    );
    const dailyByDate = new Map<string, InstagramAccountInsightDay>();
    for (const row of dailyResponse.data ?? []) {
      for (const value of row.values ?? []) {
        if (!value.end_time) continue;
        const date = value.end_time.slice(0, 10);
        const current = dailyByDate.get(date) ?? {
          date,
          reach: null,
          followerCount: null,
        };
        const numericValue =
          typeof value.value === "number" ? value.value : null;
        if (row.name === "reach") current.reach = numericValue;
        if (row.name === "follower_count") current.followerCount = numericValue;
        dailyByDate.set(date, current);
      }
    }

    const followResponse = await graphGet<InsightResponse>(
      `/${profile.id}/insights`,
      tokens.accessToken,
      {
        ...windowParams,
        metric: "follows_and_unfollows",
        metric_type: "total_value",
        breakdown: "follow_type",
      },
    );
    const followBreakdown = breakdownValues(followResponse.data?.[0]);
    const followValue = (label: string) =>
      followBreakdown.find((item) => item.label === label)?.value ?? null;

    const audience = {
      gender: [] as InstagramInsightBreakdown[],
      age: [] as InstagramInsightBreakdown[],
      country: [] as InstagramInsightBreakdown[],
      city: [] as InstagramInsightBreakdown[],
    };
    await Promise.all(
      (Object.keys(audience) as Array<keyof typeof audience>).map(
        async (breakdown) => {
          try {
            const response = await graphGet<InsightResponse>(
              `/${profile.id}/insights`,
              tokens.accessToken,
              {
                metric: "follower_demographics",
                period: "lifetime",
                timeframe: "last_90_days",
                metric_type: "total_value",
                breakdown,
              },
            );
            audience[breakdown] = breakdownValues(response.data?.[0]);
          } catch {
            // Meta withholds demographic data below its privacy threshold.
          }
        },
      ),
    );

    const total = (name: string) => metricNumber(totalMap, name);
    return {
      capturedAt: new Date().toISOString(),
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      totals: {
        views: total("views"),
        reach: total("reach"),
        profileViews: total("profile_views"),
        accountsEngaged: total("accounts_engaged"),
        totalInteractions: total("total_interactions"),
        likes: total("likes"),
        comments: total("comments"),
        shares: total("shares"),
        saves: total("saves"),
        replies: total("replies"),
        profileLinksTaps: total("profile_links_taps"),
        follows: followValue("FOLLOWER"),
        unfollows: followValue("NON_FOLLOWER"),
      },
      daily: [...dailyByDate.values()].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
      audience,
    };
  },
};

export function instagramAuthorizeRedirectUri() {
  return getOAuthCallbackUrl("instagram");
}
