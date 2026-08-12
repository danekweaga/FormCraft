import { getYoutubeChannelPosts, searchYoutubeResearch } from "../youtube";
import type {
  ContentDiscoveryProvider,
  CreatorPostsInput,
  DiscoveryCapabilities,
  SearchPostResult,
  SearchPostsInput,
} from "./types";

export function isYoutubeDiscoveryConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_DATA_API_KEY?.trim());
}

export const youtubeDiscoveryProvider: ContentDiscoveryProvider = {
  providerName: "youtube_data_api",

  capabilities(): DiscoveryCapabilities {
    const configured = isYoutubeDiscoveryConfigured();
    return {
      searchPosts: configured,
      searchCreators: false,
      getCreatorPosts: configured,
      refreshMetrics: false,
      getCreatorBaseline: false,
      platforms: ["youtube"],
      providerType: "official",
    };
  },

  async searchPosts(input: SearchPostsInput): Promise<SearchPostResult[]> {
    if (!isYoutubeDiscoveryConfigured()) return [];
    if (input.platforms && !input.platforms.includes("youtube")) return [];
    const retrievedAt = new Date().toISOString();
    const posts = await searchYoutubeResearch({
      query: input.query,
      lookbackDays: input.lookbackDays ?? 30,
      maxResults: input.maxResults ?? 50,
    });
    return posts
      .filter((p) => (p.views ?? 0) >= (input.minViews ?? 0))
      .map((post) => ({
        ...post,
        providerName: "youtube_data_api",
        collectionMethod: "official_search",
        retrievedAt,
      }));
  },

  async getCreatorPosts(input: CreatorPostsInput): Promise<SearchPostResult[]> {
    if (!isYoutubeDiscoveryConfigured()) return [];
    if (input.platform !== "youtube") return [];
    const retrievedAt = new Date().toISOString();
    const posts = await getYoutubeChannelPosts({
      channelId: input.platformCreatorId,
      maxResults: input.maxResults ?? 10,
    });
    return posts.map((post) => ({
      ...post,
      providerName: "youtube_data_api",
      collectionMethod: "official_creator_uploads",
      retrievedAt,
    }));
  },
};
