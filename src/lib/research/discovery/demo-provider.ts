import type {
  ContentDiscoveryProvider,
  DiscoveryCapabilities,
  SearchPostResult,
  SearchPostsInput,
} from "./types";

function demoEnabled() {
  return (
    process.env.RESEARCH_ENABLE_DEMO === "1" ||
    (process.env.NODE_ENV !== "production" &&
      !process.env.YOUTUBE_DATA_API_KEY?.trim())
  );
}

/** Demo fixtures only — never pretends to be live platform data. */
export const demoDiscoveryProvider: ContentDiscoveryProvider = {
  providerName: "demo",

  capabilities(): DiscoveryCapabilities {
    return {
      searchPosts: demoEnabled(),
      searchCreators: false,
      getCreatorPosts: false,
      refreshMetrics: false,
      getCreatorBaseline: false,
      platforms: ["youtube"],
      providerType: "demo",
    };
  },

  async searchPosts(input: SearchPostsInput): Promise<SearchPostResult[]> {
    if (!demoEnabled()) return [];
    const retrievedAt = new Date().toISOString();
    const q = input.query.toLowerCase();
    const fixtures: SearchPostResult[] = [
      {
        platform: "youtube",
        externalId: "demo-outlier-1",
        externalUrl: "https://www.youtube.com/watch?v=demo-outlier-1",
        creatorId: "demo-creator-a",
        creatorName: "Demo CS Creator",
        title: `${input.query}: why your projects look like everyone else's`,
        description: `Demo result for “${input.query}”. Not live platform data.`,
        thumbnailUrl: null,
        publishedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        durationSeconds: 48,
        views: 120_000,
        likes: 8_400,
        comments: 620,
        shares: null,
        providerName: "demo",
        collectionMethod: "demo_fixture",
        retrievedAt,
        creatorFollowerCount: 22_000,
      },
      {
        platform: "youtube",
        externalId: "demo-outlier-2",
        externalUrl: "https://www.youtube.com/watch?v=demo-outlier-2",
        creatorId: "demo-creator-a",
        creatorName: "Demo CS Creator",
        title: `Typical ${q.slice(0, 24)} advice video`,
        description: "Demo baseline companion post.",
        thumbnailUrl: null,
        publishedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
        durationSeconds: 55,
        views: 18_000,
        likes: 900,
        comments: 80,
        shares: null,
        providerName: "demo",
        collectionMethod: "demo_fixture",
        retrievedAt,
        creatorFollowerCount: 22_000,
      },
      {
        platform: "youtube",
        externalId: "demo-outlier-3",
        externalUrl: "https://www.youtube.com/watch?v=demo-outlier-3",
        creatorId: "demo-creator-a",
        creatorName: "Demo CS Creator",
        title: "Another baseline companion for creator median",
        description: "Demo baseline companion so creator-relative outliers work.",
        thumbnailUrl: null,
        publishedAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
        durationSeconds: 40,
        views: 22_000,
        likes: 1_100,
        comments: 90,
        shares: null,
        providerName: "demo",
        collectionMethod: "demo_fixture",
        retrievedAt,
        creatorFollowerCount: 22_000,
      },
      {
        platform: "youtube",
        externalId: "demo-outlier-4",
        externalUrl: "https://www.youtube.com/watch?v=demo-outlier-4",
        creatorId: "demo-creator-b",
        creatorName: "Demo Internship Channel",
        title: "Internship cold email that actually got replies",
        description: "Demo niche-adjacent post.",
        thumbnailUrl: null,
        publishedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        durationSeconds: 62,
        views: 45_000,
        likes: 2_100,
        comments: 310,
        shares: null,
        providerName: "demo",
        collectionMethod: "demo_fixture",
        retrievedAt,
        creatorFollowerCount: 9_500,
      },
    ];
    return fixtures.slice(0, input.maxResults ?? 25);
  },
};
