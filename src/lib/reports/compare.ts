import type { ReportMetricGroup, ReportResult } from "./types";

function movement(before: ReportMetricGroup[], after: ReportMetricGroup[]) {
  const prior = new Map(before.map((group) => [group.key, group]));
  return after
    .map((group) => ({
      label: group.label,
      before: prior.get(group.key)?.medianRelativeViews ?? null,
      after: group.medianRelativeViews,
      delta:
        group.medianRelativeViews != null && prior.get(group.key)?.medianRelativeViews != null
          ? group.medianRelativeViews - prior.get(group.key)!.medianRelativeViews!
          : null,
    }))
    .filter((item) => item.delta != null)
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!));
}

export function compareReports(before: ReportResult, after: ReportResult) {
  const beforeSignals = new Set(before.audienceSignals.map((signal) => signal.summary));
  const afterSignals = new Set(after.audienceSignals.map((signal) => signal.summary));
  return {
    topicMovement: movement(before.topicGroups, after.topicGroups),
    hookMovement: movement(before.hookGroups, after.hookGroups),
    formatMovement: movement(before.formatGroups, after.formatGroups),
    newAudienceSignals: [...afterSignals].filter((signal) => !beforeSignals.has(signal)),
    disappearedAudienceSignals: [...beforeSignals].filter((signal) => !afterSignals.has(signal)),
    experimentChange: after.experiments.length - before.experiments.length,
    roadmapProgressChange:
      (after.roadmap[0]?.progressPct ?? 0) - (before.roadmap[0]?.progressPct ?? 0),
    warnings: [
      ...(before.provenance.snapshotHash === after.provenance.snapshotHash ? ["Both runs use the same deterministic data snapshot."] : []),
      ...(before.reportType !== after.reportType ? ["These are different report types, so comparisons are directional."] : []),
    ],
  };
}
