import type { ReportResult } from "./types";

function section(title: string, items: string[]): string {
  return `## ${title}\n\n${items.length ? items.map((item) => `- ${item}`).join("\n") : "- None available."}`;
}

export function reportToMarkdown(report: ReportResult): string {
  return [
    `# ${report.title}`,
    report.summary,
    section("Observed Data", report.observedData),
    section("Patterns", report.patterns),
    section("AI Interpretation", report.aiInterpretation),
    section("Contradictory Evidence", report.contradictoryEvidence),
    section("What This Report Cannot Conclude", report.cannotConclude),
    section("Recommended Actions", report.recommendedActions),
    ...(report.feedbackPlan ? [section("Next Three Posts", report.feedbackPlan.nextThreePosts), `## Controlled Test\n\n${report.feedbackPlan.controlledTest}\n\n## Success Check\n\n${report.feedbackPlan.successCheck}\n\n## Review\n\n${report.feedbackPlan.reviewAfter}`] : []),
    section("Data Quality", [...report.dataQuality.warnings, `Coverage: ${report.dataQuality.metricsCoveragePct}%`, `Confidence: ${report.dataQuality.confidence}`]),
    `## Provenance\n\nSnapshot: \`${report.provenance.snapshotHash}\`\n\nMetrics: ${report.provenance.metricsUsed.join(", ")}`,
  ].join("\n\n");
}
