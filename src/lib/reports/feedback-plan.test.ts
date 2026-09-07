import { describe, expect, it } from "vitest";
import type { ReportMetricGroup } from "./types";
import { buildReportFeedbackPlan } from "./feedback-plan";

function group(label: string, score: number, sampleSize: number): ReportMetricGroup {
  return { key: label, label, sampleSize, medianRelativeViews: score, medianShares: 2, medianSaves: 3, medianComments: 4, medianEngagementRate: 0.1, conversationSignal: "mixed", confidence: "medium", supportingPostIds: [], contradictoryPostIds: [] };
}

describe("report feedback plan", () => {
  it("turns the strongest evidence into a three-post test", () => {
    const plan = buildReportFeedbackPlan({ eligiblePosts: 12, topics: [group("Projects", 1.8, 5), group("AI news", 0.7, 4)], hooks: [group("Story", 1.4, 4)], formats: [group("Talking Head", 1.3, 5)] });
    expect(plan.focus).toContain("Projects");
    expect(plan.nextThreePosts).toHaveLength(3);
    expect(plan.controlledTest).toContain("Story");
  });

  it("asks for comparable posts when evidence is too small", () => {
    const plan = buildReportFeedbackPlan({ eligiblePosts: 1, topics: [], hooks: [], formats: [] });
    expect(plan.focus).toMatch(/comparable posts/i);
    expect(plan.reviewAfter).toMatch(/seven days/i);
  });
});
