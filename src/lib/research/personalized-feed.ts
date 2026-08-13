export type FeedFeedbackSignal = {
  research_item_id: string | null;
  feedback_type: string;
  created_at?: string | null;
};

export type PersonalizedFeedCandidate = {
  id: string;
  platform: string;
  external_creator_id: string | null;
  creator_name: string | null;
  title: string | null;
  description: string | null;
  topic: string | null;
  views: number | null;
  outlier_score: number | null;
  published_at: string | null;
  saved: boolean;
  analysis_model: string | null;
  personalScore?: number;
  personalFit?: string | null;
  whyRelevant?: string[];
};

export type PersonalizedFeedOptions = {
  feedback?: FeedFeedbackSignal[];
  watchedCreatorIds?: string[];
  highPerformingTopics?: string[];
  maxAgeDays?: number;
  now?: Date;
};

export type PersonalizedFeedResult<T> = T & {
  recommendationScore: number;
  personalFit: "strong" | "medium" | "weak";
  whyRelevant: string[];
};

const NEGATIVE_FEEDBACK = new Set([
  "not_relevant",
  "already_covered",
  "wrong_audience",
  "wrong_niche",
]);

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "from",
  "have",
  "into",
  "more",
  "that",
  "their",
  "this",
  "with",
  "your",
]);

function tokens(value: string | null | undefined): string[] {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function normalizedTopic(value: string | null | undefined): string {
  return tokens(value).slice(0, 8).join(" ");
}

function overlapsTopic(
  item: Pick<PersonalizedFeedCandidate, "title" | "description" | "topic">,
  topic: string,
): boolean {
  const wanted = new Set(tokens(topic));
  if (wanted.size === 0) return false;
  const itemTokens = new Set(
    tokens(`${item.topic ?? ""} ${item.title ?? ""} ${item.description ?? ""}`),
  );
  const overlap = [...wanted].filter((word) => itemTokens.has(word)).length;
  return overlap >= Math.min(2, wanted.size);
}

function latestFeedbackByItem(
  feedback: FeedFeedbackSignal[],
): Map<string, FeedFeedbackSignal> {
  const sorted = feedback
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const aTime = a.entry.created_at
        ? new Date(a.entry.created_at).getTime()
        : 0;
      const bTime = b.entry.created_at
        ? new Date(b.entry.created_at).getTime()
        : 0;
      return bTime - aTime || a.index - b.index;
    });
  const latest = new Map<string, FeedFeedbackSignal>();
  for (const { entry } of sorted) {
    if (!entry.research_item_id || latest.has(entry.research_item_id)) continue;
    latest.set(entry.research_item_id, entry);
  }
  return latest;
}

function addAffinity(map: Map<string, number>, key: string | null, value: number) {
  if (!key || value === 0) return;
  map.set(key, (map.get(key) ?? 0) + value);
}

function seedStrength(
  item: PersonalizedFeedCandidate,
  feedback: FeedFeedbackSignal | undefined,
): number {
  let strength = item.saved ? 2 : 0;
  if (item.analysis_model) strength += 1;
  if (feedback?.feedback_type === "relevant") strength += 3;
  if (feedback?.feedback_type === "save_for_later") strength += 2;
  if (feedback && NEGATIVE_FEEDBACK.has(feedback.feedback_type)) strength -= 4;
  return strength;
}

function freshnessPoints(publishedAt: string | null, now: Date): number {
  if (!publishedAt) return 0;
  const timestamp = new Date(publishedAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (now.getTime() - timestamp) / 86_400_000);
  if (ageDays <= 3) return 6;
  if (ageDays <= 7) return 4;
  if (ageDays <= 14) return 2;
  return 0;
}

function popularityPoints(views: number | null): number {
  if (!views || views < 20_000) return 0;
  return Math.min(12, Math.max(0, Math.log10(views / 20_000) * 8));
}

function fitForScore(score: number): "strong" | "medium" | "weak" {
  if (score >= 65) return "strong";
  if (score >= 30) return "medium";
  return "weak";
}

function uniqueReasons(reasons: Array<string | null | undefined>): string[] {
  return [...new Set(reasons.filter((reason): reason is string => Boolean(reason)))];
}

/**
 * Ranks the user's real 30-day research pool without calling an LLM.
 * Personal context and behavior lead; popularity is a bounded quality signal.
 * A greedy diversity pass prevents one creator, topic, or platform taking over.
 */
export function rankPersonalizedFeed<T extends PersonalizedFeedCandidate>(
  items: T[],
  options: PersonalizedFeedOptions = {},
): Array<PersonalizedFeedResult<T>> {
  const now = options.now ?? new Date();
  const maxAgeDays = options.maxAgeDays ?? 30;
  const latestFeedback = latestFeedbackByItem(options.feedback ?? []);
  const watchedCreators = new Set(options.watchedCreatorIds ?? []);
  const highPerformingTopics = options.highPerformingTopics ?? [];
  const creatorAffinity = new Map<string, number>();
  const topicAffinity = new Map<string, number>();
  const platformAffinity = new Map<string, number>();
  const seedByItem = new Map<string, number>();

  for (const item of items) {
    const seed = seedStrength(item, latestFeedback.get(item.id));
    seedByItem.set(item.id, seed);
    addAffinity(creatorAffinity, item.external_creator_id, seed);
    addAffinity(topicAffinity, normalizedTopic(item.topic), seed);
    addAffinity(platformAffinity, item.platform, seed * 0.5);
  }
  for (const creatorId of watchedCreators) {
    addAffinity(creatorAffinity, creatorId, 2);
  }

  const scored = items.flatMap((item) => {
    if (item.published_at) {
      const publishedAt = new Date(item.published_at).getTime();
      const ageDays = (now.getTime() - publishedAt) / 86_400_000;
      if (Number.isFinite(ageDays) && ageDays > maxAgeDays) return [];
    }
    const directFeedback = latestFeedback.get(item.id)?.feedback_type;
    if (directFeedback && NEGATIVE_FEEDBACK.has(directFeedback)) return [];

    const seed = seedByItem.get(item.id) ?? 0;
    const creatorSignal = item.external_creator_id
      ? (creatorAffinity.get(item.external_creator_id) ?? 0) - seed
      : 0;
    const topicKey = normalizedTopic(item.topic);
    const topicSignal = topicKey
      ? (topicAffinity.get(topicKey) ?? 0) - seed
      : 0;
    const platformSignal = (platformAffinity.get(item.platform) ?? 0) - seed * 0.5;
    const matchingWinner = highPerformingTopics.find((topic) =>
      overlapsTopic(item, topic),
    );
    const watched = Boolean(
      item.external_creator_id && watchedCreators.has(item.external_creator_id),
    );

    let score = item.personalScore ?? 0;
    const reasons: string[] = [...(item.whyRelevant ?? [])];

    if (directFeedback === "relevant") {
      score += 32;
      reasons.unshift("You marked this video as relevant");
    } else if (directFeedback === "save_for_later") {
      score += 18;
      reasons.unshift("You saved this signal for later");
    }
    if (item.saved) {
      score += 9;
      reasons.push("You saved this research reference");
    }
    if (item.analysis_model) {
      score += 6;
      reasons.push("You previously analyzed this reference");
    }
    if (watched) {
      score += 20;
      reasons.unshift("From a creator you track");
    } else if (creatorSignal > 0) {
      score += Math.min(20, creatorSignal * 6);
      reasons.push("Similar to creators you saved or analyzed");
    } else if (creatorSignal < 0) {
      score += Math.max(-24, creatorSignal * 6);
    }
    if (topicSignal > 0) {
      score += Math.min(16, topicSignal * 5);
      reasons.push("Similar to topics you saved or analyzed");
    } else if (topicSignal < 0) {
      score += Math.max(-18, topicSignal * 5);
    }
    if (platformSignal > 0) {
      score += Math.min(8, platformSignal * 3);
      reasons.push(`Your research activity favors ${item.platform}`);
    } else if (platformSignal < 0) {
      score += Math.max(-10, platformSignal * 3);
    }
    if (matchingWinner) {
      score += 18;
      reasons.unshift(`Matches a topic that performed for you: ${matchingWinner}`);
    }

    score += freshnessPoints(item.published_at, now);
    score += popularityPoints(item.views);

    if ((item.outlier_score ?? 0) >= 1.5) {
      reasons.push("Beating this creator's normal baseline");
    }

    const recommendationScore = Math.round(score * 10) / 10;
    return [
      {
        ...item,
        recommendationScore,
        personalFit: fitForScore(recommendationScore),
        whyRelevant: uniqueReasons(reasons).slice(0, 5),
      },
    ];
  });

  const remaining = [...scored];
  const ranked: Array<PersonalizedFeedResult<T>> = [];
  const creatorCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  const platformCounts = new Map<string, number>();

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestAdjusted = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const item = remaining[index];
      const creatorKey = item.external_creator_id ?? item.creator_name ?? "unknown";
      const topicKey = normalizedTopic(item.topic) || "unclassified";
      const creatorCount = creatorCounts.get(creatorKey) ?? 0;
      const topicCount = topicCounts.get(topicKey) ?? 0;
      const platformCount = platformCounts.get(item.platform) ?? 0;
      const last = ranked.at(-1);
      const lastTwo = ranked.slice(-2);

      let adjusted = item.recommendationScore;
      adjusted -= creatorCount * 14;
      adjusted -= topicCount * 5;
      adjusted -= platformCount * 1.5;
      if (last && (last.external_creator_id ?? last.creator_name) === creatorKey) {
        adjusted -= 14;
      }
      if (
        lastTwo.length === 2 &&
        lastTwo.every((previous) => previous.platform === item.platform)
      ) {
        adjusted -= 8;
      }
      if (creatorCount >= 2 && remaining.some(
        (candidate) =>
          (candidate.external_creator_id ?? candidate.creator_name ?? "unknown") !==
          creatorKey,
      )) {
        adjusted -= 80;
      }

      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIndex = index;
      }
    }

    const [selected] = remaining.splice(bestIndex, 1);
    ranked.push(selected);
    const creatorKey =
      selected.external_creator_id ?? selected.creator_name ?? "unknown";
    const topicKey = normalizedTopic(selected.topic) || "unclassified";
    creatorCounts.set(creatorKey, (creatorCounts.get(creatorKey) ?? 0) + 1);
    topicCounts.set(topicKey, (topicCounts.get(topicKey) ?? 0) + 1);
    platformCounts.set(
      selected.platform,
      (platformCounts.get(selected.platform) ?? 0) + 1,
    );
  }

  return ranked;
}
