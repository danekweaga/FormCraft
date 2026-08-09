import { searchYoutubeResearch } from "../youtube";
import type {
  ContentDiscoveryProvider,
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
    return {
      searchPosts: isYoutubeDiscoveryConfigured(),
      searchCreators: false,
      getCreatorPosts: false,
      refreshMetrics: false,
      getCreatorBaseline: false,
      platforms: ["youtube"],
      providerType: "official",
    };
  },

  async searchPosts(input: SearchPostsInput): Promise<SearchPostResult[]> {
    if (!isYoutubeDiscoveryConfigured()) return [];
    const retrievedAt = new Date().toISOString();
    const posts = await searchYoutubeResearch({
      query: input.query,
      lookbackDays: input.lookbackDays ?? 30,
      maxResults: input.maxResults ?? 25,
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
};
