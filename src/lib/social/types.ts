export type SocialPlatform =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "linkedin"
  | "x"
  | "threads";

export type OwnedPlatform = "instagram" | "youtube" | "tiktok";

export type ProviderCapabilities = {
  profile: boolean;
  posts: boolean;
  postMetrics: boolean;
  comments: boolean;
  retention: boolean;
  audienceInsights: boolean;
  channelAnalytics: boolean;
};

export type OwnedProfile = {
  platformAccountId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
  metadata?: Record<string, unknown>;
};

export type OwnedPost = {
  platformPostId: string;
  url: string | null;
  caption: string | null;
  title: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  format?: string | null;
  raw?: Record<string, unknown>;
};

export type PostMetrics = {
  platformPostId: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  followersGained: number | null;
  watchTimeSeconds: number | null;
  averageViewDurationSeconds: number | null;
  completionRate: number | null;
  profileVisits: number | null;
  linkClicks: number | null;
  extra?: Record<string, number | null>;
  raw?: Record<string, unknown>;
};

export type InstagramInsightBreakdown = {
  label: string;
  value: number;
};

export type InstagramAccountInsightDay = {
  date: string;
  reach: number | null;
  followerCount: number | null;
};

export type InstagramAccountInsights = {
  capturedAt: string;
  rangeStart: string;
  rangeEnd: string;
  totals: {
    views: number | null;
    reach: number | null;
    profileViews: number | null;
    accountsEngaged: number | null;
    totalInteractions: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    replies: number | null;
    profileLinksTaps: number | null;
    follows: number | null;
    unfollows: number | null;
  };
  daily: InstagramAccountInsightDay[];
  audience: {
    gender: InstagramInsightBreakdown[];
    age: InstagramInsightBreakdown[];
    country: InstagramInsightBreakdown[];
    city: InstagramInsightBreakdown[];
  };
};

export type CommentResult = {
  platformCommentId: string;
  platformPostId: string;
  body: string;
  publishedAt: string | null;
  authorName: string | null;
  authorUsername: string | null;
  raw?: Record<string, unknown>;
};

export type TokenBundle = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  scopes: string[];
  metadata?: Record<string, unknown>;
};

export type ConnectionResult = {
  profile: OwnedProfile;
  tokens: TokenBundle;
};

export type TokenResult = TokenBundle;

export type AuthorizationParams = {
  userId: string;
  redirectUri: string;
  state: string;
  codeVerifier?: string;
  codeChallenge?: string;
};

export type CallbackParams = {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
};

export interface OwnedSocialProvider {
  platform: OwnedPlatform;
  displayName: string;
  capabilities: ProviderCapabilities;
  isConfigured(): boolean;
  unconfiguredReason(): string | null;
  getAuthorizationUrl(params: AuthorizationParams): Promise<string>;
  handleCallback(params: CallbackParams): Promise<ConnectionResult>;
  refreshAuthorization?(tokens: TokenBundle): Promise<TokenResult>;
  revokeAuthorization?(tokens: TokenBundle): Promise<void>;
  getProfile(tokens: TokenBundle): Promise<OwnedProfile>;
  getPosts(
    tokens: TokenBundle,
    options?: { cursor?: string | null; limit?: number },
  ): Promise<{ posts: OwnedPost[]; nextCursor?: string | null }>;
  getPostMetrics(
    tokens: TokenBundle,
    postIds: string[],
    options?: { mediaTypes?: Record<string, string | null | undefined> },
  ): Promise<PostMetrics[]>;
  getAccountInsights?(
    tokens: TokenBundle,
  ): Promise<InstagramAccountInsights>;
  getComments?(
    tokens: TokenBundle,
    postIds: string[],
  ): Promise<CommentResult[]>;
}

export type SyncProgressStep = {
  id: string;
  label: string;
  state: "pending" | "active" | "done" | "error" | "skipped";
  detail?: string;
};

export type SocialConnectionRow = {
  id: string;
  user_id: string;
  platform: SocialPlatform;
  platform_account_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  account_type: "owned" | "reference";
  status: "connected" | "not_connected" | "needs_attention" | "syncing" | "disconnected";
  granted_scopes: string[];
  token_expires_at: string | null;
  last_synced_at: string | null;
  last_successful_sync_at: string | null;
  next_scheduled_sync_at: string | null;
  last_error: string | null;
  auto_sync_enabled: boolean;
  sync_frequency_hours: number;
  import_comments: boolean;
  import_older_posts: boolean;
  use_for_ai: boolean;
  use_for_roadmap: boolean;
  use_for_experiments: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
