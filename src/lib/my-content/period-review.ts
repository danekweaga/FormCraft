import type { ContentPostRow } from "./schemas";
import { getPostEngagementRate, getPostEngagements } from "./performance";

export type PeriodKind = "week" | "month";

export type PeriodReviewPrefs = {
  /** Inclusive local hour, 0–23. Default 9. */
  peakHoursStart: number;
  /** Exclusive local hour, 0–24. Default 12 (covers 9:00–11:59). */
  peakHoursEnd: number;
  timeZone: string;
  /** Topics you enjoy posting even when they underperform. */
  enjoymentTopics: string[];
  /** Topics you treat as the growth / niche lane. */
  growthTopics: string[];
};

export const DEFAULT_PERIOD_REVIEW_PREFS: PeriodReviewPrefs = {
  peakHoursStart: 9,
  peakHoursEnd: 12,
  timeZone: "America/Sao_Paulo",
  enjoymentTopics: [
    "self improvement",
    "self-improvement",
    "mindset",
    "motivation",
    "yap",
    "life",
    "habits",
  ],
  growthTopics: [
    "computer science",
    "cs",
    "coding",
    "programming",
    "software",
    "ai",
    "internship",
    "portfolio",
    "tech",
  ],
};

export type ReviewedPost = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  externalUrl: string | null;
  views: number | null;
  engagements: number | null;
  engagementRate: number | null;
  publishedAt: string;
  hourLocal: number | null;
  inPeakWindow: boolean | null;
  topicLabel: string;
  topicKind: "growth" | "enjoyment" | "other";
  viewsVsMedian: number | null;
  reasons: string[];
  tone: "win" | "weak" | "mixed";
};

export type PeriodReview = {
  period: PeriodKind;
  days: number;
  postCount: number;
  postsWithViews: number;
  medianViews: number | null;
  winners: ReviewedPost[];
  weakest: ReviewedPost[];
  topicSplit: Array<{
    kind: "growth" | "enjoyment" | "other";
    postCount: number;
    averageViews: number | null;
    note: string;
  }>;
  postingTime: {
    inPeak: { postCount: number; averageViews: number | null };
    offPeak: { postCount: number; averageViews: number | null };
    caveat: string;
  };
  makeMoreOf: string[];
  keepForJoy: string[];
  hypotheses: string[];
};

const DAY_MS = 86_400_000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function postTitle(post: ContentPostRow): string {
  return (
    post.title?.trim() ||
    post.caption?.trim().slice(0, 90) ||
    "Untitled post"
  );
}

function topicBlob(post: ContentPostRow): string {
  const classified =
    typeof post.classification?.topic === "string"
      ? post.classification.topic
      : typeof post.classification?.content_pillar === "string"
        ? post.classification.content_pillar
        : "";
  return [
    post.topic,
    post.content_pillar,
    classified,
    post.title,
    post.caption?.slice(0, 200),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesAny(blob: string, needles: string[]): boolean {
  return needles.some((needle) => {
    const cleaned = needle.trim().toLowerCase();
    return cleaned.length > 0 && blob.includes(cleaned);
  });
}

export function classifyTopicKind(
  post: ContentPostRow,
  prefs: PeriodReviewPrefs,
): { label: string; kind: ReviewedPost["topicKind"] } {
  const blob = topicBlob(post);
  const label =
    post.topic?.trim() ||
    post.content_pillar?.trim() ||
    (typeof post.classification?.topic === "string"
      ? post.classification.topic
      : null) ||
    "Unclassified";

  const enjoyment = matchesAny(blob, prefs.enjoymentTopics);
  const growth = matchesAny(blob, prefs.growthTopics);

  if (enjoyment && !growth) return { label, kind: "enjoyment" };
  if (growth && !enjoyment) return { label, kind: "growth" };
  if (growth && enjoyment) return { label, kind: "growth" };
  return { label, kind: "other" };
}

export function localPublishHour(
  publishedAt: string,
  timeZone: string,
): number | null {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone,
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === "hour")?.value;
    if (!hour) return null;
    const parsed = Number(hour === "24" ? "0" : hour);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isInPeakWindow(
  hour: number | null,
  prefs: PeriodReviewPrefs,
): boolean | null {
  if (hour === null) return null;
  const start = ((prefs.peakHoursStart % 24) + 24) % 24;
  const end = ((prefs.peakHoursEnd % 24) + 24) % 24;
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function filterPostsForPeriod(
  posts: ContentPostRow[],
  period: PeriodKind,
  now = new Date(),
): ContentPostRow[] {
  const days = period === "week" ? 7 : 30;
  const start = now.getTime() - days * DAY_MS;
  return posts.filter((post) => {
    if (!post.published_at) return false;
    const published = new Date(post.published_at).getTime();
    return Number.isFinite(published) && published >= start && published <= now.getTime();
  });
}

function buildReasons(params: {
  views: number | null;
  medianViews: number | null;
  topicKind: ReviewedPost["topicKind"];
  inPeakWindow: boolean | null;
  peakLabel: string;
  engagementRate: number | null;
  cohortEngagementMedian: number | null;
}): { reasons: string[]; tone: ReviewedPost["tone"] } {
  const reasons: string[] = [];
  let tone: ReviewedPost["tone"] = "mixed";
  const { views, medianViews } = params;

  if (views != null && medianViews != null && medianViews > 0) {
    const ratio = views / medianViews;
    if (ratio >= 1.4) {
      tone = "win";
      reasons.push(
        `Views were ${ratio.toFixed(1)}× your period median (${Math.round(medianViews).toLocaleString()}).`,
      );
    } else if (ratio <= 0.7) {
      tone = "weak";
      reasons.push(
        `Views were ${ratio.toFixed(1)}× your period median (${Math.round(medianViews).toLocaleString()}).`,
      );
    } else {
      reasons.push(
        `Views landed near your period median (${Math.round(medianViews).toLocaleString()}).`,
      );
    }
  } else {
    reasons.push("Views are missing, so ranking confidence is low.");
  }

  if (params.topicKind === "enjoyment") {
    reasons.push(
      "This looks like an enjoyment / self-improvement lane post — keep it if you like making it, even when it trails CS posts.",
    );
  } else if (params.topicKind === "growth") {
    reasons.push("Tagged closer to your growth / CS lane.");
  }

  if (params.inPeakWindow === false) {
    reasons.push(
      `Posted outside your peak window (${params.peakLabel}). That can dampen early distribution — but a strong video can still win anyway.`,
    );
  } else if (params.inPeakWindow === true) {
    reasons.push(`Posted inside your peak window (${params.peakLabel}).`);
  }

  if (
    params.engagementRate != null &&
    params.cohortEngagementMedian != null &&
    params.cohortEngagementMedian > 0
  ) {
    const erRatio = params.engagementRate / params.cohortEngagementMedian;
    if (erRatio >= 1.3) {
      reasons.push(
        `Engagement rate was ${erRatio.toFixed(1)}× the period median — people who saw it cared.`,
      );
      if (tone === "weak") tone = "mixed";
      if (tone === "mixed" && (views ?? 0) >= (medianViews ?? 0)) tone = "win";
    } else if (erRatio <= 0.7) {
      reasons.push(
        `Engagement rate was ${erRatio.toFixed(1)}× the period median — weaker hold after the view.`,
      );
    }
  }

  return { reasons, tone };
}

export function buildPeriodReview(params: {
  posts: ContentPostRow[];
  period: PeriodKind;
  prefs?: Partial<PeriodReviewPrefs>;
  now?: Date;
}): PeriodReview {
  const prefs: PeriodReviewPrefs = {
    ...DEFAULT_PERIOD_REVIEW_PREFS,
    ...params.prefs,
    enjoymentTopics:
      params.prefs?.enjoymentTopics ?? DEFAULT_PERIOD_REVIEW_PREFS.enjoymentTopics,
    growthTopics:
      params.prefs?.growthTopics ?? DEFAULT_PERIOD_REVIEW_PREFS.growthTopics,
  };
  const now = params.now ?? new Date();
  const days = params.period === "week" ? 7 : 30;
  const periodPosts = filterPostsForPeriod(params.posts, params.period, now);
  const viewValues = periodPosts
    .map((post) => post.views)
    .filter((value): value is number => typeof value === "number");
  const medianViews = median(viewValues);
  const engagementRates = periodPosts
    .map((post) => getPostEngagementRate(post)?.value ?? null)
    .filter((value): value is number => value !== null);
  const cohortEngagementMedian = median(engagementRates);
  const peakLabel = `${prefs.peakHoursStart}:00–${prefs.peakHoursEnd}:00 ${prefs.timeZone}`;

  const reviewed: ReviewedPost[] = periodPosts
    .filter((post) => post.published_at)
    .map((post) => {
      const hourLocal = localPublishHour(post.published_at!, prefs.timeZone);
      const inPeakWindow = isInPeakWindow(hourLocal, prefs);
      const { label, kind } = classifyTopicKind(post, prefs);
      const views = typeof post.views === "number" ? post.views : null;
      const engagementRate = getPostEngagementRate(post)?.value ?? null;
      const { reasons, tone } = buildReasons({
        views,
        medianViews,
        topicKind: kind,
        inPeakWindow,
        peakLabel,
        engagementRate,
        cohortEngagementMedian,
      });

      return {
        id: post.id,
        title: postTitle(post),
        thumbnailUrl: post.thumbnail_url ?? null,
        externalUrl: post.external_url ?? null,
        views,
        engagements: getPostEngagements(post),
        engagementRate,
        publishedAt: post.published_at!,
        hourLocal,
        inPeakWindow,
        topicLabel: label,
        topicKind: kind,
        viewsVsMedian:
          views != null && medianViews != null && medianViews > 0
            ? views / medianViews
            : null,
        reasons,
        tone,
      };
    })
    .sort((a, b) => (b.views ?? -1) - (a.views ?? -1));

  const winners = reviewed.filter((post) => post.tone === "win").slice(0, 5);
  const weakest = [...reviewed]
    .filter(
      (post) =>
        post.tone === "weak" ||
        (post.viewsVsMedian != null && post.viewsVsMedian <= 0.7),
    )
    .sort((a, b) => (a.views ?? Infinity) - (b.views ?? Infinity))
    .slice(0, 5);

  const topicKinds: Array<ReviewedPost["topicKind"]> = [
    "growth",
    "enjoyment",
    "other",
  ];
  const topicSplit = topicKinds.map((kind) => {
    const group = reviewed.filter((post) => post.topicKind === kind);
    const avg = average(
      group
        .map((post) => post.views)
        .filter((value): value is number => value !== null),
    );
    const note =
      kind === "enjoyment"
        ? "Enjoyment posts can lag CS and still be worth making if you like the account."
        : kind === "growth"
          ? "Growth-lane posts are the ones to remix when you want reach."
          : "Unclassified — add topics in My Content to sharpen this split.";
    return {
      kind,
      postCount: group.length,
      averageViews: avg,
      note,
    };
  });

  const inPeakPosts = reviewed.filter((post) => post.inPeakWindow === true);
  const offPeakPosts = reviewed.filter((post) => post.inPeakWindow === false);
  const postingTime = {
    inPeak: {
      postCount: inPeakPosts.length,
      averageViews: average(
        inPeakPosts
          .map((post) => post.views)
          .filter((value): value is number => value !== null),
      ),
    },
    offPeak: {
      postCount: offPeakPosts.length,
      averageViews: average(
        offPeakPosts
          .map((post) => post.views)
          .filter((value): value is number => value !== null),
      ),
    },
    caveat:
      "Posting time can help early distribution, but a strong video can still travel outside your peak window. Use time as a lever, not a verdict.",
  };

  const makeMoreOf = winners.slice(0, 3).map((post) => {
    const hook = post.title.slice(0, 72);
    return `${post.topicLabel}: remake “${hook}” (${post.views?.toLocaleString() ?? "—"} views)`;
  });

  const keepForJoy = reviewed
    .filter((post) => post.topicKind === "enjoyment")
    .slice(0, 3)
    .map(
      (post) =>
        `Keep making “${post.title.slice(0, 64)}” if you enjoy it — treat soft metrics as expected for this lane.`,
    );

  const hypotheses: string[] = [];
  const growthAvg = topicSplit.find((row) => row.kind === "growth")?.averageViews;
  const joyAvg = topicSplit.find((row) => row.kind === "enjoyment")?.averageViews;
  if (
    growthAvg != null &&
    joyAvg != null &&
    growthAvg > joyAvg * 1.25 &&
    (topicSplit.find((row) => row.kind === "enjoyment")?.postCount ?? 0) > 0
  ) {
    hypotheses.push(
      "CS / growth posts are outperforming self-improvement yaps in this window. That is useful for remakes — not a reason to delete the joy lane.",
    );
  }
  if (
    postingTime.inPeak.averageViews != null &&
    postingTime.offPeak.averageViews != null &&
    postingTime.inPeak.postCount >= 2 &&
    postingTime.offPeak.postCount >= 2
  ) {
    if (postingTime.inPeak.averageViews > postingTime.offPeak.averageViews * 1.2) {
      hypotheses.push(
        `In this window, peak-hour posts averaged higher views than off-peak. Prefer ${peakLabel} when you can — without assuming late posts are doomed.`,
      );
    } else if (
      postingTime.offPeak.averageViews >=
      postingTime.inPeak.averageViews * 0.9
    ) {
      hypotheses.push(
        "Off-peak posts are roughly keeping up with peak-hour posts here — content quality is likely doing more work than the clock.",
      );
    }
  }
  if (winners.length === 0 && reviewed.length > 0) {
    hypotheses.push(
      "No clear winner vs your period median yet. Publish a few more comparable posts, then regenerate this review.",
    );
  }
  if (makeMoreOf.length > 0) {
    hypotheses.push(
      "Best next move: remake the structure of your top posts (hook, pacing, promise) before inventing a new niche.",
    );
  }

  return {
    period: params.period,
    days,
    postCount: periodPosts.length,
    postsWithViews: viewValues.length,
    medianViews,
    winners: winners.length > 0 ? winners : reviewed.slice(0, 3),
    weakest,
    topicSplit,
    postingTime,
    makeMoreOf,
    keepForJoy,
    hypotheses,
  };
}
