import { describe, expect, it } from "vitest";
import type { ContentPostRow } from "./schemas";
import {
  buildPeriodReview,
  classifyTopicKind,
  isInPeakWindow,
  localPublishHour,
  DEFAULT_PERIOD_REVIEW_PREFS,
} from "./period-review";

const NOW = new Date("2026-08-15T15:00:00.000Z");

function post(
  overrides: Partial<ContentPostRow> & { id: string },
): ContentPostRow {
  return {
    platform: "instagram",
    source: "synced",
    source_label: "Instagram",
    title: "Post",
    caption: null,
    topic: null,
    content_pillar: null,
    hook_text: null,
    classification: null,
    format: null,
    published_at: "2026-08-12T12:00:00.000Z",
    views: 100,
    likes: 10,
    comments: 2,
    shares: 1,
    saves: 1,
    followers_gained: null,
    is_winner: false,
    needs_review: false,
    relative_performance: {},
    created_at: "2026-08-12T12:00:00.000Z",
    ...overrides,
  } as ContentPostRow;
}

describe("period-review", () => {
  it("classifies growth vs enjoyment topics", () => {
    expect(
      classifyTopicKind(
        post({ id: "cs", topic: "Computer Science internship tips" }),
        DEFAULT_PERIOD_REVIEW_PREFS,
      ).kind,
    ).toBe("growth");
    expect(
      classifyTopicKind(
        post({ id: "joy", caption: "A self improvement yap about habits" }),
        DEFAULT_PERIOD_REVIEW_PREFS,
      ).kind,
    ).toBe("enjoyment");
  });

  it("detects peak hours in the creator timezone", () => {
    // 12:30 UTC on Aug 12 => 09:30 in America/Sao_Paulo (UTC-3)
    const hour = localPublishHour(
      "2026-08-12T12:30:00.000Z",
      "America/Sao_Paulo",
    );
    expect(hour).toBe(9);
    expect(
      isInPeakWindow(hour, {
        ...DEFAULT_PERIOD_REVIEW_PREFS,
        peakHoursStart: 9,
        peakHoursEnd: 12,
      }),
    ).toBe(true);
    expect(isInPeakWindow(22, DEFAULT_PERIOD_REVIEW_PREFS)).toBe(false);
  });

  it("builds week winners, soft posts, and enjoyment-aware hypotheses", () => {
    const review = buildPeriodReview({
      now: NOW,
      period: "week",
      posts: [
        post({
          id: "win",
          title: "CS portfolio tip",
          topic: "Computer Science",
          views: 4000,
          published_at: "2026-08-12T12:30:00.000Z",
        }),
        post({
          id: "joy",
          title: "Morning mindset yap",
          caption: "self improvement thoughts",
          views: 200,
          published_at: "2026-08-13T02:00:00.000Z",
        }),
        post({
          id: "mid",
          title: "Another CS short",
          topic: "coding",
          views: 900,
          published_at: "2026-08-14T12:00:00.000Z",
        }),
        post({
          id: "late",
          title: "Late night CS",
          topic: "AI for students",
          views: 250,
          published_at: "2026-08-11T03:00:00.000Z",
        }),
      ],
    });

    expect(review.postCount).toBe(4);
    expect(review.winners[0]?.id).toBe("win");
    expect(review.weakest.some((row) => row.id === "joy")).toBe(true);
    expect(
      review.weakest
        .find((row) => row.id === "joy")
        ?.reasons.some((reason) => reason.toLowerCase().includes("enjoyment")),
    ).toBe(true);
    expect(review.hypotheses.join(" ")).toMatch(/CS|growth|quality|remake/i);
    expect(review.makeMoreOf.length).toBeGreaterThan(0);
  });
});
