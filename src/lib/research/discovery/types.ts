import type { ResearchPlatform, ResearchVideoCandidate } from "../types";

export type DiscoveryCapabilities = {
  searchPosts: boolean;
  searchCreators: boolean;
  getCreatorPosts: boolean;
  refreshMetrics: boolean;
  getCreatorBaseline: boolean;
  platforms: ResearchPlatform[];
  providerType: "official" | "third_party" | "personal_monitoring" | "manual" | "demo";
};

export type SearchPostsInput = {
  query: string;
  platforms?: ResearchPlatform[];
  lookbackDays?: number;
  maxResults?: number;
  minViews?: number;
  language?: string;
  /** Prefer recency on incremental For You pulls. */
  sortBy?: "relevance" | "latest";
};

export type SearchCreatorsInput = {
  query: string;
  platform?: ResearchPlatform;
  maxResults?: number;
};

export type CreatorPostsInput = {
  platform: ResearchPlatform;
  platformCreatorId: string;
  maxResults?: number;
  /** Stop paging once the provider has crossed this rolling window. */
  lookbackDays?: number;
  /** Paid providers use one credit per page; callers allocate the safe maximum. */
  maxPages?: number;
};

export type RefreshExternalMetricsInput = {
  platform: ResearchPlatform;
  platformPostIds: string[];
};

export type CreatorBaselineInput = {
  platform: ResearchPlatform;
  platformCreatorId: string;
  recentPosts: Array<{ views: number | null; format?: string | null }>;
};

export type SearchPostResult = ResearchVideoCandidate & {
  providerName: string;
  collectionMethod: string;
  retrievedAt: string;
  creatorFollowerCount?: number | null;
  /** Keyword that produced this row, used to keep For You search hits. */
  matchedQuery?: string;
};

export type SearchCreatorResult = {
  platform: ResearchPlatform;
  platformCreatorId: string;
  handle: string | null;
  displayName: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
  providerName: string;
  retrievedAt: string;
};

export type ExternalMetricResult = {
  platformPostId: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  capturedAt: string;
};

export type CreatorBaselineResult = {
  medianViews: number | null;
  sampleSize: number;
  confidence: "low" | "medium" | "high";
  method: string;
};

export interface ContentDiscoveryProvider {
  providerName: string;
  capabilities(): DiscoveryCapabilities;
  searchPosts(input: SearchPostsInput): Promise<SearchPostResult[]>;
  searchCreators?(input: SearchCreatorsInput): Promise<SearchCreatorResult[]>;
  getCreatorPosts?(input: CreatorPostsInput): Promise<SearchPostResult[]>;
  refreshMetrics?(
    input: RefreshExternalMetricsInput,
  ): Promise<ExternalMetricResult[]>;
  getCreatorBaseline?(
    input: CreatorBaselineInput,
  ): Promise<CreatorBaselineResult>;
}
