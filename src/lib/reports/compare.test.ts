import { describe, expect, it } from "vitest";
import { compareReports } from "./compare";
import type { ReportResult } from "./types";

function report(relative: number, signal: string, hash: string): ReportResult {
  const group = { key: "ai", label: "AI", sampleSize: 3, medianRelativeViews: relative, medianShares: 2, medianSaves: 2, medianComments: 2, medianEngagementRate: 0.1, conversationSignal: "mixed" as const, confidence: "medium" as const, supportingPostIds: [], contradictoryPostIds: [] };
  return { version: 1, reportType: "content_strategy_audit", title: "Audit", summary: "", observedData: [], patterns: [], aiInterpretation: [], contradictoryEvidence: [], cannotConclude: [], recommendedActions: [], dataQuality: { eligiblePosts: 3, postsWithMetrics: 3, metricsCoveragePct: 100, hookClassifications: 3, formatClassifications: 3, topicClassifications: 3, postsWithAudienceComments: 0, retentionAvailable: 0, newestMetricAt: null, freshness: "unknown", warnings: [], confidence: "medium" }, topicGroups: [group], hookGroups: [group], formatGroups: [group], audienceSignals: [{ id: signal, type: "question", summary: signal, sampleSize: 2, confidence: "medium" }], emergingSignals: [], experiments: [], roadmap: [], psychologyContext: [], findings: [], evidence: [], actions: [], provenance: { sourceCounts: {}, metricsUsed: [], snapshotHash: hash } };
}

describe("compareReports", () => {
  it("reports metric movement and signal changes", () => {
    const comparison = compareReports(report(0.8, "old", "a"), report(1.2, "new", "b"));
    expect(comparison.topicMovement[0]?.delta).toBeCloseTo(0.4);
    expect(comparison.newAudienceSignals).toEqual(["new"]);
    expect(comparison.disappearedAudienceSignals).toEqual(["old"]);
  });
});
