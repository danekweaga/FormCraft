import type { SupabaseClient } from "@supabase/supabase-js";

const STOP_WORDS = new Set([
  "and",
  "about",
  "after",
  "again",
  "also",
  "because",
  "been",
  "before",
  "being",
  "best",
  "can",
  "creator",
  "for",
  "from",
  "have",
  "how",
  "into",
  "just",
  "make",
  "more",
  "most",
  "not",
  "other",
  "shorts",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "video",
  "videos",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "you",
  "your",
]);

export type CreatorSuggestionPost = {
  creatorId: string;
  title: string | null;
  description: string | null;
  topic: string | null;
  outlierScore: number | null;
  views: number | null;
};

export type CreatorSuggestionCandidate = {
  id: string;
  platform: string;
  handle: string | null;
  displayName: string | null;
  followerCount: number | null;
};

export type ScoredCreatorSuggestion = {
  externalCreatorId: string;
  score: number;
  reasons: string[];
  matchedTopics: string[];
  seedCreatorIds: string[];
  evidence: {
    sharedSignalCount: number;
    recentPostCount: number;
    outlierPostCount: number;
    strongestOutlierScore: number | null;
    samePlatform: boolean;
  };
};

export function creatorSignalTokens(value: string | null | undefined): string[] {
  return (value ?? "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s/_,|:-]+/)
    .map((token) => token.replace(/^[.#-]+|[.#-]+$/g, ""))
    .filter(
      (token) =>
        token.length >= 3 && token.length <= 30 && !STOP_WORDS.has(token),
    );
}

function postTokens(post: CreatorSuggestionPost): string[] {
  return creatorSignalTokens(
    [post.topic, post.title, post.description].filter(Boolean).join(" "),
  );
}

function buildWeights(values: string[]): Map<string, number> {
  const weights = new Map<string, number>();
  for (const value of values) {
    for (const token of creatorSignalTokens(value)) {
      weights.set(token, (weights.get(token) ?? 0) + 1);
    }
  }
  return weights;
}

export function buildCreatorRecommendationQuery(params: {
  niche: string | null;
  topics: string[];
  keywords: string[];
  seedPosts: CreatorSuggestionPost[];
}): string {
  const seedWeights = buildWeights([
    ...params.topics,
    ...params.keywords,
    ...params.seedPosts.flatMap((post) => [
      post.topic ?? "",
      post.title ?? "",
    ]),
  ]);
  const strongest = [...seedWeights.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([token]) => token)
    .filter((token) => !creatorSignalTokens(params.niche).includes(token))
    .slice(0, 5);
  const query = [params.niche, ...strongest].filter(Boolean).join(" ").trim();
  return query.slice(0, 160) || "creator content ideas";
}

export function scoreSimilarCreators(params: {
  seedCreatorIds: string[];
  seedPlatforms: string[];
  seedPosts: CreatorSuggestionPost[];
  nicheSignals: string[];
  candidates: CreatorSuggestionCandidate[];
  candidatePosts: CreatorSuggestionPost[];
  excludedCreatorIds: string[];
}): ScoredCreatorSuggestion[] {
  const excluded = new Set(params.excludedCreatorIds);
  const seedPlatforms = new Set(params.seedPlatforms);
  const seedWeights = buildWeights([
    ...params.nicheSignals,
    ...params.seedPosts.flatMap((post) => [
      post.topic ?? "",
      post.title ?? "",
      post.description ?? "",
    ]),
  ]);
  const strongestSeedTokens = [...seedWeights.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 40);
  const seedWeightTotal = Math.max(
    1,
    strongestSeedTokens.reduce((sum, [, weight]) => sum + weight, 0),
  );

  const postsByCreator = new Map<string, CreatorSuggestionPost[]>();
  for (const post of params.candidatePosts) {
    const posts = postsByCreator.get(post.creatorId) ?? [];
    posts.push(post);
    postsByCreator.set(post.creatorId, posts);
  }

  return params.candidates
    .filter((candidate) => !excluded.has(candidate.id))
    .flatMap((candidate): ScoredCreatorSuggestion[] => {
      const posts = postsByCreator.get(candidate.id) ?? [];
      if (posts.length === 0) return [];
      const candidateTokens = new Set(posts.flatMap(postTokens));
      const matches = strongestSeedTokens.filter(([token]) =>
        candidateTokens.has(token),
      );
      if (matches.length === 0) return [];

      const matchedWeight = matches.reduce((sum, [, weight]) => sum + weight, 0);
      const topicFit = Math.min(1, (matchedWeight / seedWeightTotal) * 3.5);
      const outlierScores = posts
        .map((post) => post.outlierScore)
        .filter((score): score is number => score != null && score > 0);
      const strongestOutlier = outlierScores.length
        ? Math.max(...outlierScores)
        : null;
      const outlierPostCount = outlierScores.filter((score) => score >= 1.5).length;
      const outlierEvidence = strongestOutlier
        ? Math.min(1, Math.log2(Math.max(1, strongestOutlier)) / 3)
        : 0;
      const activityEvidence = Math.min(1, posts.length / 5);
      const samePlatform = seedPlatforms.has(candidate.platform);
      const score = Math.round(
        100 *
          (topicFit * 0.65 +
            outlierEvidence * 0.2 +
            activityEvidence * 0.1 +
            (samePlatform ? 0.05 : 0)),
      );
      const matchedTopics = matches.map(([token]) => token).slice(0, 5);
      const reasons = [
        `Shares ${matchedTopics.length} watchlist signal${matchedTopics.length === 1 ? "" : "s"}: ${matchedTopics.join(", ")}`,
        outlierPostCount > 0 && strongestOutlier != null
          ? `${outlierPostCount} recent outlier post${outlierPostCount === 1 ? "" : "s"}; strongest ${strongestOutlier.toFixed(1)}x baseline`
          : `${posts.length} relevant recent post${posts.length === 1 ? "" : "s"} found`,
        samePlatform
          ? `Matches a platform already represented in this watchlist`
          : `Adds a cross-platform view of the same topics`,
      ];

      return [
        {
          externalCreatorId: candidate.id,
          score,
          reasons,
          matchedTopics,
          seedCreatorIds: params.seedCreatorIds.slice(0, 20),
          evidence: {
            sharedSignalCount: matchedTopics.length,
            recentPostCount: posts.length,
            outlierPostCount,
            strongestOutlierScore: strongestOutlier,
            samePlatform,
          },
        },
      ];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);
}

type CreatorRow = {
  id: string;
  platform: string;
  handle: string | null;
  display_name: string | null;
  follower_count: number | null;
};

type ItemRow = {
  external_creator_id: string | null;
  title: string | null;
  description: string | null;
  topic: string | null;
  outlier_score: number | null;
  views: number | null;
};

function toSuggestionPost(row: ItemRow): CreatorSuggestionPost | null {
  if (!row.external_creator_id) return null;
  return {
    creatorId: row.external_creator_id,
    title: row.title,
    description: row.description,
    topic: row.topic,
    outlierScore: row.outlier_score,
    views: row.views,
  };
}

export async function getWatchlistRecommendationSeed(params: {
  supabase: SupabaseClient;
  userId: string;
  watchlistId: string;
}): Promise<{
  query: string;
  seedCreatorIds: string[];
  nicheSignals: string[];
}> {
  const [{ data: watchlist }, { data: members }, { data: profile }] =
    await Promise.all([
      params.supabase
        .from("research_watchlists")
        .select("id, name")
        .eq("id", params.watchlistId)
        .eq("user_id", params.userId)
        .maybeSingle(),
      params.supabase
        .from("research_watchlist_members")
        .select("external_creator_id")
        .eq("watchlist_id", params.watchlistId),
      params.supabase
        .from("niche_profiles")
        .select("main_niche, topics, keywords")
        .eq("user_id", params.userId)
        .maybeSingle(),
    ]);
  if (!watchlist) throw new Error("Watchlist not found.");
  const seedCreatorIds = Array.from(
    new Set((members ?? []).map((member) => member.external_creator_id)),
  ).filter(Boolean);
  if (seedCreatorIds.length === 0) {
    throw new Error("Add at least one creator before finding similar accounts.");
  }
  const { data: rows } = await params.supabase
    .from("research_items")
    .select(
      "external_creator_id, title, description, topic, outlier_score, views",
    )
    .eq("user_id", params.userId)
    .in("external_creator_id", seedCreatorIds)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(160);
  const seedPosts = (rows ?? [])
    .map((row) => toSuggestionPost(row as ItemRow))
    .filter((post): post is CreatorSuggestionPost => Boolean(post));
  const topics = (profile?.topics ?? []).map(String);
  const keywords = (profile?.keywords ?? []).map(String);
  return {
    query: buildCreatorRecommendationQuery({
      niche: profile?.main_niche ?? watchlist.name,
      topics,
      keywords,
      seedPosts,
    }),
    seedCreatorIds,
    nicheSignals: [profile?.main_niche, ...topics, ...keywords].filter(
      (value): value is string => Boolean(value),
    ),
  };
}

export async function refreshCreatorSuggestionsFromLibrary(params: {
  supabase: SupabaseClient;
  userId: string;
  watchlistId?: string;
}): Promise<{ generated: number; watchlists: number }> {
  let listsQuery = params.supabase
    .from("research_watchlists")
    .select("id")
    .eq("user_id", params.userId)
    .eq("paused", false);
  if (params.watchlistId) listsQuery = listsQuery.eq("id", params.watchlistId);
  const { data: watchlists, error: listsError } = await listsQuery;
  if (listsError) throw new Error(listsError.message);

  const [{ data: creators }, { data: profile }] = await Promise.all([
    params.supabase
      .from("external_creators")
      .select("id, platform, handle, display_name, follower_count")
      .eq("user_id", params.userId)
      .eq("tracking_paused", false)
      .limit(750),
    params.supabase
      .from("niche_profiles")
      .select("main_niche, topics, keywords")
      .eq("user_id", params.userId)
      .maybeSingle(),
  ]);
  const allCreators = (creators ?? []) as CreatorRow[];
  if (allCreators.length === 0) return { generated: 0, watchlists: 0 };

  const { data: itemRows } = await params.supabase
    .from("research_items")
    .select(
      "external_creator_id, title, description, topic, outlier_score, views",
    )
    .eq("user_id", params.userId)
    .eq("hidden", false)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1800);
  const posts = ((itemRows ?? []) as ItemRow[])
    .map(toSuggestionPost)
    .filter((post): post is CreatorSuggestionPost => Boolean(post));
  const nicheSignals = [
    profile?.main_niche,
    ...(profile?.topics ?? []),
    ...(profile?.keywords ?? []),
  ].filter((value): value is string => Boolean(value));

  let generated = 0;
  const { data: allMemberships } = await params.supabase
    .from("research_watchlist_members")
    .select("watchlist_id, external_creator_id")
    .in(
      "watchlist_id",
      (watchlists ?? []).map((entry) => entry.id),
    );
  for (const watchlist of watchlists ?? []) {
    const watchedIds = Array.from(
      new Set(
        (allMemberships ?? []).map((member) => member.external_creator_id),
      ),
    ).filter(Boolean);
    const seedCreatorIds = (allMemberships ?? [])
      .filter((member) => member.watchlist_id === watchlist.id)
      .map((member) => member.external_creator_id)
      .filter(Boolean);
    if (seedCreatorIds.length === 0) continue;

    const { data: priorSuggestions } = await params.supabase
      .from("research_creator_suggestions")
      .select("external_creator_id, status")
      .eq("user_id", params.userId)
      .eq("watchlist_id", watchlist.id);
    const dismissedOrAccepted = (priorSuggestions ?? [])
      .filter((entry) => entry.status !== "pending")
      .map((entry) => entry.external_creator_id);
    const seedCreators = allCreators.filter((creator) =>
      seedCreatorIds.includes(creator.id),
    );
    const seedPosts = posts.filter((post) =>
      seedCreatorIds.includes(post.creatorId),
    );
    const candidateIds = new Set(
      posts
        .map((post) => post.creatorId)
        .filter(
          (creatorId) =>
            !watchedIds.includes(creatorId) &&
            !dismissedOrAccepted.includes(creatorId),
        ),
    );
    const candidates = allCreators.filter((creator) =>
      candidateIds.has(creator.id),
    );
    const scored = scoreSimilarCreators({
      seedCreatorIds,
      seedPlatforms: seedCreators.map((creator) => creator.platform),
      seedPosts,
      nicheSignals,
      candidates: candidates.map((creator) => ({
        id: creator.id,
        platform: creator.platform,
        handle: creator.handle,
        displayName: creator.display_name,
        followerCount: creator.follower_count,
      })),
      candidatePosts: posts.filter((post) => candidateIds.has(post.creatorId)),
      excludedCreatorIds: [...watchedIds, ...dismissedOrAccepted],
    });
    if (scored.length === 0) continue;

    const { error } = await params.supabase
      .from("research_creator_suggestions")
      .upsert(
        scored.map((suggestion) => ({
          user_id: params.userId,
          watchlist_id: watchlist.id,
          external_creator_id: suggestion.externalCreatorId,
          score: suggestion.score,
          reasons: suggestion.reasons,
          matched_topics: suggestion.matchedTopics,
          seed_creator_ids: suggestion.seedCreatorIds,
          evidence: suggestion.evidence,
          status: "pending",
          generated_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,watchlist_id,external_creator_id" },
      );
    if (error) throw new Error(error.message);
    generated += scored.length;
  }

  return { generated, watchlists: (watchlists ?? []).length };
}
