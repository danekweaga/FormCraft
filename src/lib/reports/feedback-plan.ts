import type { ReportMetricGroup } from "./types";

export type ReportFeedbackPlan = {
  focus: string;
  evidence: string;
  nextThreePosts: string[];
  controlledTest: string;
  successCheck: string;
  reviewAfter: string;
};

function strongest(groups: ReportMetricGroup[]): ReportMetricGroup | null {
  return [...groups]
    .filter((group) => !/^(unclassified|other)$/i.test(group.label) && group.medianRelativeViews != null && group.sampleSize > 0)
    .sort((a, b) => (b.medianRelativeViews ?? 0) - (a.medianRelativeViews ?? 0))[0] ?? null;
}

export function buildReportFeedbackPlan(params: { eligiblePosts: number; topics: ReportMetricGroup[]; hooks: ReportMetricGroup[]; formats: ReportMetricGroup[] }): ReportFeedbackPlan {
  const topic = strongest(params.topics);
  const hook = strongest(params.hooks);
  const format = strongest(params.formats);
  const topicName = topic?.label ?? "your clearest CS/student problem";
  const hookName = hook?.label ?? "a direct problem-first opening";
  const formatName = format?.label ?? "your most repeatable format";
  const evidence = [topic, hook, format].filter(Boolean).map((group) => `${group!.label} ${group!.medianRelativeViews!.toFixed(2)}× across ${group!.sampleSize} post${group!.sampleSize === 1 ? "" : "s"}`).join("; ");
  if (params.eligiblePosts < 3) return {
    focus: "Collect enough comparable posts to learn from your own performance.",
    evidence: `Only ${params.eligiblePosts} eligible post${params.eligiblePosts === 1 ? " was" : "s were"} available, so a winner would be premature.`,
    nextThreePosts: ["Publish one CS/student problem with a direct opening.", "Publish a second post on the same topic with a different hook.", "Publish a third post keeping the stronger hook and changing only the example."],
    controlledTest: "Change one creative variable per post so the comparison is useful.",
    successCheck: "Compare relative views, shares, saves, comments, and follows where the platform supplies them.",
    reviewAfter: "Review after all three posts have had seven days to collect metrics.",
  };
  return {
    focus: `Build the next three posts around ${topicName}.`,
    evidence: evidence || "The report has performance data but no stable classified topic, hook, or format yet.",
    nextThreePosts: [`Repeat ${topicName} using ${formatName} and a ${hookName.toLowerCase()}.`, `Use the same ${topicName} promise with a different concrete example from your own experience.`, `Answer the strongest audience question about ${topicName}; keep the opening and format consistent with the better of the first two posts.`],
    controlledTest: `Test ${hookName} against one alternate hook while keeping topic, format, length, and posting window as similar as practical.`,
    successCheck: "Call it promising only if it beats your account baseline and improves at least one deeper signal: shares, saves, comments, or follows where available.",
    reviewAfter: "Review seven days after the third post. Keep the winner, revise mixed evidence, and stop the pattern after two repeated misses.",
  };
}
