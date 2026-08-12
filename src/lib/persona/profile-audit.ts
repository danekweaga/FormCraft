export type ProfileAuditPost = {
  title: string | null;
  caption: string | null;
  topic: string | null;
  contentPillar: string | null;
  classification?: Record<string, unknown> | null;
};

export type CreatorProfileAudit = {
  status: "on_strategy" | "mixed" | "drifting" | "insufficient_data";
  alignmentPercent: number | null;
  alignedPosts: number;
  totalPosts: number;
  topThemes: Array<{ name: string; posts: number }>;
  pillarCoverage: Array<{ pillar: string; posts: number; covered: boolean }>;
  offStrategyThemes: Array<{ name: string; posts: number }>;
  recommendations: string[];
  bioChecks: Array<{ label: string; passed: boolean; note: string }>;
  suggestedBio: string | null;
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "because",
  "been",
  "before",
  "but",
  "can",
  "content",
  "creator",
  "for",
  "from",
  "have",
  "help",
  "helps",
  "how",
  "into",
  "make",
  "more",
  "that",
  "the",
  "their",
  "this",
  "through",
  "video",
  "videos",
  "what",
  "when",
  "where",
  "with",
  "you",
  "your",
]);

function tokens(value: string | null | undefined): string[] {
  return (value ?? "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s/_,|:-]+/)
    .map((token) => token.replace(/^[.#-]+|[.#-]+$/g, ""))
    .map((token) =>
      token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token,
    )
    .filter(
      (token) =>
        (token.length >= 3 || ["ai", "cs", "ui", "ux"].includes(token)) &&
        token.length <= 32 &&
        !STOP_WORDS.has(token),
    );
}

function normalizedTheme(post: ProfileAuditPost): string {
  const classifiedPillar =
    typeof post.classification?.content_pillar === "string"
      ? post.classification.content_pillar
      : null;
  const classifiedTopic =
    typeof post.classification?.topic === "string"
      ? post.classification.topic
      : null;
  return (
    post.contentPillar ||
    classifiedPillar ||
    post.topic ||
    classifiedTopic ||
    "Unclassified"
  ).trim();
}

function postText(post: ProfileAuditPost): string {
  return [
    post.title,
    post.caption,
    post.topic,
    post.contentPillar,
    typeof post.classification?.topic === "string"
      ? post.classification.topic
      : null,
    typeof post.classification?.content_pillar === "string"
      ? post.classification.content_pillar
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function matchesSignal(text: string, signal: string): boolean {
  const postTokens = new Set(tokens(text));
  const signalTokens = tokens(signal);
  if (signalTokens.length === 0) return false;
  return signalTokens.some((token) => postTokens.has(token));
}

function shortPhrase(value: string, maxWords: number): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, maxWords)
    .join(" ");
}

export function buildSuggestedBio(params: {
  whatIMake: string;
  audience: string;
  pillars: string[];
}): string | null {
  const topicLine = params.pillars.slice(0, 3).join(" · ");
  const audienceLine = shortPhrase(params.audience, 8);
  const promiseLine = shortPhrase(params.whatIMake, 9);
  const lines = [
    promiseLine,
    audienceLine ? `For ${audienceLine}` : "",
    topicLine,
  ].filter(Boolean);
  if (lines.length === 0) return null;
  let bio = lines.join("\n");
  if (bio.length <= 150) return bio;
  bio = [promiseLine, topicLine].filter(Boolean).join("\n");
  return bio.slice(0, 150).trim();
}

export function auditCreatorProfile(params: {
  whatIMake: string;
  audience: string;
  socialBio: string;
  contentPillars: string[];
  posts: ProfileAuditPost[];
}): CreatorProfileAudit {
  const posts = params.posts.slice(0, 60);
  const explicitSignals = params.contentPillars.filter(Boolean);
  const strategySignals = [
    ...explicitSignals,
    ...tokens(params.whatIMake).slice(0, 12),
  ];
  const themeCounts = new Map<string, number>();
  const alignedByIndex = posts.map((post) => {
    const theme = normalizedTheme(post);
    themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    if (strategySignals.length === 0) return false;
    const text = postText(post);
    return strategySignals.some((signal) => matchesSignal(text, signal));
  });
  const alignedPosts = alignedByIndex.filter(Boolean).length;
  const enoughData = posts.length >= 5 && strategySignals.length > 0;
  const alignmentPercent = enoughData
    ? Math.round((alignedPosts / posts.length) * 100)
    : null;
  const status: CreatorProfileAudit["status"] =
    alignmentPercent == null
      ? "insufficient_data"
      : alignmentPercent >= 70
        ? "on_strategy"
        : alignmentPercent >= 45
          ? "mixed"
          : "drifting";
  const topThemes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([name, count]) => ({ name, posts: count }));
  const pillarCoverage = explicitSignals.map((pillar) => {
    const count = posts.filter((post) => matchesSignal(postText(post), pillar)).length;
    return { pillar, posts: count, covered: count > 0 };
  });
  const offStrategyThemes = topThemes.filter(
    (theme) =>
      theme.name !== "Unclassified" &&
      !strategySignals.some((signal) => matchesSignal(theme.name, signal)),
  );

  const bioTokens = new Set(tokens(params.socialBio));
  const audienceTokens = tokens(params.audience).slice(0, 10);
  const promiseTokens = tokens(params.whatIMake).slice(0, 12);
  const pillarTokens = explicitSignals.flatMap(tokens);
  const hasAudience = audienceTokens.some((token) => bioTokens.has(token));
  const hasPromise = [...promiseTokens, ...pillarTokens].some((token) =>
    bioTokens.has(token),
  );
  const hasAction = /\b(follow|build|learn|join|watch|start|dm|download|subscribe|↓|👇)\b/i.test(
    params.socialBio,
  );
  const bioChecks = [
    {
      label: "Audience clarity",
      passed: hasAudience,
      note: hasAudience
        ? "The bio names or strongly signals the intended viewer."
        : "Name the viewer or the situation they recognize themselves in.",
    },
    {
      label: "Content promise",
      passed: hasPromise,
      note: hasPromise
        ? "The bio overlaps with your promise or approved pillars."
        : "State what someone will consistently get from following you.",
    },
    {
      label: "Next action",
      passed: hasAction,
      note: hasAction
        ? "The bio contains a clear next step."
        : "Add one honest next step only if the profile has somewhere useful to send people.",
    },
    {
      label: "Instagram length",
      passed: params.socialBio.length > 0 && params.socialBio.length <= 150,
      note:
        params.socialBio.length === 0
          ? "Save your current bio to audit it."
          : params.socialBio.length <= 150
            ? `${params.socialBio.length}/150 characters.`
            : `${params.socialBio.length}/150 characters; shorten before publishing.`,
    },
  ];

  const recommendations: string[] = [];
  if (status === "drifting") {
    recommendations.push(
      "Your recent posts have weak overlap with the saved direction. Decide whether the off-strategy theme is a deliberate new pillar or should be reduced.",
    );
  } else if (status === "mixed") {
    recommendations.push(
      "Your direction is visible but inconsistent. Use the next five posts to repeat one under-covered pillar before changing the whole profile.",
    );
  } else if (status === "on_strategy") {
    recommendations.push(
      "Your recent content matches the saved direction. Keep the positioning stable and test hooks or formats instead of changing the niche.",
    );
  } else {
    recommendations.push(
      "Add at least five classified posts and clear content pillars before treating drift as a reliable signal.",
    );
  }
  const missingPillars = pillarCoverage.filter((pillar) => !pillar.covered);
  if (missingPillars.length > 0) {
    recommendations.push(
      `No recent post covered ${missingPillars.map((item) => item.pillar).join(", ")}. Publish one intentional test or remove pillars you no longer want to own.`,
    );
  }
  if (bioChecks.filter((check) => check.passed).length < 3) {
    recommendations.push(
      "The saved bio does not fully express the current strategy. Revise the draft below, but update Instagram manually only after the new direction is intentional.",
    );
  }

  return {
    status,
    alignmentPercent,
    alignedPosts,
    totalPosts: posts.length,
    topThemes,
    pillarCoverage,
    offStrategyThemes,
    recommendations,
    bioChecks,
    suggestedBio: buildSuggestedBio({
      whatIMake: params.whatIMake,
      audience: params.audience,
      pillars: explicitSignals,
    }),
  };
}
