import {
  getOAuthCallbackUrl,
  isPlatformConfigured,
  platformUnconfiguredReason,
  REQUESTED_SCOPES,
  tiktokConfig,
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

async function tiktokToken(body: Record<string, string>) {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_expires_in?: number;
    scope?: string;
    open_id?: string;
    error?: string;
    error_description?: string;
    message?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description ??
        json.message ??
        json.error ??
        "TikTok token request failed",
    );
  }
  return json;
}

export const tiktokOwnedProvider: OwnedSocialProvider = {
  platform: "tiktok",
  displayName: "TikTok",
  capabilities: {
    profile: true,
    posts: true,
    postMetrics: true,
    comments: false,
    retention: false,
    audienceInsights: false,
    channelAnalytics: false,
  },

  isConfigured() {
    return isPlatformConfigured("tiktok");
  },

  unconfiguredReason() {
    return platformUnconfiguredReason("tiktok");
  },

  async getAuthorizationUrl(params: AuthorizationParams) {
    const { clientKey } = tiktokConfig();
    if (!clientKey) throw new Error(this.unconfiguredReason()!);
    if (!params.codeChallenge) {
      throw new Error("TikTok OAuth requires PKCE code_challenge");
    }
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", clientKey);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", REQUESTED_SCOPES.tiktok.join(","));
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("state", params.state);
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  },

  async handleCallback(params: CallbackParams): Promise<ConnectionResult> {
    const { clientKey, clientSecret } = tiktokConfig();
    if (!clientKey || !clientSecret) throw new Error(this.unconfiguredReason()!);
    if (!params.codeVerifier) {
      throw new Error("TikTok OAuth requires PKCE code_verifier");
    }

    const tokenJson = await tiktokToken({
      client_key: clientKey,
      client_secret: clientSecret,
      code: params.code,
      grant_type: "authorization_code",
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    });

    const tokens: TokenBundle = {
      accessToken: tokenJson.access_token!,
      refreshToken: tokenJson.refresh_token ?? null,
      expiresAt: tokenJson.expires_in
        ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
        : null,
      scopes: tokenJson.scope?.split(/[,\s]+/).filter(Boolean) ?? [
        ...REQUESTED_SCOPES.tiktok,
      ],
      metadata: {
        provider: "tiktok",
        open_id: tokenJson.open_id,
      },
    };

    const profile = await this.getProfile(tokens);
    return { profile, tokens };
  },

  async refreshAuthorization(tokens: TokenBundle): Promise<TokenResult> {
    const { clientKey, clientSecret } = tiktokConfig();
    if (!clientKey || !clientSecret) throw new Error(this.unconfiguredReason()!);
    if (!tokens.refreshToken) {
      throw new Error("TikTok refresh token missing — reconnect the account");
    }
    const json = await tiktokToken({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    });
    return {
      ...tokens,
      accessToken: json.access_token!,
      refreshToken: json.refresh_token ?? tokens.refreshToken,
      expiresAt: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : tokens.expiresAt,
      scopes: json.scope?.split(/[,\s]+/).filter(Boolean) ?? tokens.scopes,
      metadata: {
        ...tokens.metadata,
        open_id: json.open_id ?? tokens.metadata?.open_id,
      },
    };
  },

  async getProfile(tokens: TokenBundle): Promise<OwnedProfile> {
    const res = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count",
      {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      },
    );
    const json = (await res.json()) as {
      data?: {
        user?: {
          open_id?: string;
          avatar_url?: string;
          display_name?: string;
          follower_count?: number;
          following_count?: number;
          likes_count?: number;
          video_count?: number;
        };
      };
      error?: { message?: string; code?: string };
    };
    if (!res.ok || json.error?.code === "access_token_invalid") {
      throw new Error(json.error?.message ?? "TikTok profile fetch failed");
    }
    const user = json.data?.user;
    if (!user?.open_id) {
      throw new Error(
        json.error?.message ??
          "TikTok profile unavailable with current scopes",
      );
    }

    return {
      platformAccountId: user.open_id,
      username: null,
      displayName: user.display_name ?? null,
      avatarUrl: user.avatar_url ?? null,
      followerCount:
        typeof user.follower_count === "number" ? user.follower_count : null,
      metadata: {
        followingCount:
          typeof user.following_count === "number" ? user.following_count : null,
        likesCount:
          typeof user.likes_count === "number" ? user.likes_count : null,
        videoCount:
          typeof user.video_count === "number" ? user.video_count : null,
        note: "TikTok Display/Login Kit scopes only return approved fields — analytics are not identical to Instagram/YouTube.",
      },
    };
  },

  async getPosts(tokens, options) {
    const maxCount = Math.min(Math.max(options?.limit ?? 20, 1), 20);
    const res = await fetch(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,create_time,cover_image_url,share_url,title,video_description,duration,view_count,like_count,comment_count,share_count",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          max_count: maxCount,
          cursor: options?.cursor ? Number(options.cursor) : undefined,
        }),
      },
    );
    const json = (await res.json()) as {
      data?: {
        videos?: Array<{
          id: string;
          create_time?: number;
          cover_image_url?: string;
          share_url?: string;
          title?: string;
          video_description?: string;
          duration?: number;
          view_count?: number;
          like_count?: number;
          comment_count?: number;
          share_count?: number;
        }>;
        cursor?: number;
        has_more?: boolean;
      };
      error?: { message?: string; code?: string };
    };
    if (!res.ok || (json.error && json.error.code !== "ok")) {
      throw new Error(json.error?.message ?? "TikTok video list failed");
    }

    const posts: OwnedPost[] = (json.data?.videos ?? []).map((video) => ({
      platformPostId: video.id,
      url: video.share_url ?? null,
      caption: video.video_description ?? video.title ?? null,
      title: video.title ?? null,
      publishedAt: video.create_time
        ? new Date(video.create_time * 1000).toISOString()
        : null,
      thumbnailUrl: video.cover_image_url ?? null,
      durationSeconds:
        typeof video.duration === "number" ? video.duration : null,
      format: "video",
      raw: {
        view_count: video.view_count ?? null,
        like_count: video.like_count ?? null,
        comment_count: video.comment_count ?? null,
        share_count: video.share_count ?? null,
      },
    }));

    return {
      posts,
      nextCursor:
        json.data?.has_more && json.data.cursor != null
          ? String(json.data.cursor)
          : null,
    };
  },

  async getPostMetrics(tokens, postIds): Promise<PostMetrics[]> {
    // TikTok list endpoint already returns basic stats; re-list and filter
    const { posts } = await this.getPosts(tokens, { limit: 20 });
    const byId = new Map(posts.map((p) => [p.platformPostId, p]));
    return postIds.map((id) => {
      const post = byId.get(id);
      const raw = (post?.raw ?? {}) as Record<string, number | null | undefined>;
      return {
        platformPostId: id,
        views: typeof raw.view_count === "number" ? raw.view_count : null,
        reach: null,
        likes: typeof raw.like_count === "number" ? raw.like_count : null,
        comments:
          typeof raw.comment_count === "number" ? raw.comment_count : null,
        shares: typeof raw.share_count === "number" ? raw.share_count : null,
        saves: null,
        followersGained: null,
        watchTimeSeconds: null,
        averageViewDurationSeconds: null,
        completionRate: null,
        profileVisits: null,
        linkClicks: null,
      };
    });
  },
};

export function tiktokAuthorizeRedirectUri() {
  return getOAuthCallbackUrl("tiktok");
}
