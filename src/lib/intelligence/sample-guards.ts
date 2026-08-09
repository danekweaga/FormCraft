export type ConfidenceLabel = "low" | "medium" | "high";

export const SAMPLE_GUARDS = {
  topicComparisonMinPerGroup: 3,
  hookComparisonMinPerGroup: 3,
  experimentPostsPerVariant: 3,
  performanceLessonMinPosts: 5,
  audienceInsightMinMentions: 3,
  backlogIdeasThreshold: 10,
  backlogDraftsThreshold: 4,
} as const;

export function confidenceFromSample(sampleSize: number): ConfidenceLabel {
  if (sampleSize >= 12) return "high";
  if (sampleSize >= SAMPLE_GUARDS.performanceLessonMinPosts) return "medium";
  return "low";
}

export function hasEnoughForComparison(
  groupA: number,
  groupB: number,
  min = SAMPLE_GUARDS.topicComparisonMinPerGroup,
): boolean {
  return groupA >= min && groupB >= min;
}

export function notEnoughEvidenceMessage(needed: number, have: number): string {
  return `Not enough evidence yet (${have}/${needed} samples).`;
}
