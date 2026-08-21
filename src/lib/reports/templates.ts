import type { ReportType, ReportWindow } from "./types";

export type ReportTemplate = {
  type: ReportType;
  name: string;
  description: string;
  defaultWindow: ReportWindow;
  recommended?: boolean;
};

export const REPORT_TEMPLATES: ReportTemplate[] = [
  { type: "content_strategy_audit", name: "Content Strategy Audit", description: "See which topics, hooks, formats, and structures are actually working.", defaultWindow: { kind: "last_posts", count: 20 }, recommended: true },
  { type: "weekly_content_review", name: "Weekly Content Review", description: "Understand what happened this week and what changed.", defaultWindow: { kind: "last_days", days: 30 } },
  { type: "audience_demand_report", name: "Audience Demand Report", description: "Surface what viewers are discussing, requesting, questioning, and sharing.", defaultWindow: { kind: "last_posts", count: 30 } },
  { type: "signal_finder_report", name: "Signal Finder Report", description: "Find intersections between audience demand and the content you care about making.", defaultWindow: { kind: "last_posts", count: 30 } },
  { type: "hook_report", name: "Hook Report", description: "Compare hook families, sample sizes, conversation, saves, shares, and retention evidence.", defaultWindow: { kind: "last_posts", count: 30 } },
  { type: "format_report", name: "Format Report", description: "Compare formats without separating them from the topics and payoffs they carry.", defaultWindow: { kind: "last_posts", count: 30 } },
  { type: "experiment_report", name: "Experiment Report", description: "Review active and completed tests, evidence strength, and remaining uncertainty.", defaultWindow: { kind: "last_days", days: 90 } },
  { type: "content_pillar_report", name: "Content Pillar Report", description: "Evaluate coverage, performance, audience demand, creator interest, and drift.", defaultWindow: { kind: "last_posts", count: 30 } },
  { type: "roadmap_progress_report", name: "Roadmap Progress Report", description: "Compare current goals with the evidence now available.", defaultWindow: { kind: "last_days", days: 90 } },
  { type: "winner_breakdown_report", name: "Winner Breakdown Report", description: "Inspect the strongest recent content and the evidence that separates it.", defaultWindow: { kind: "last_posts", count: 20 } },
  { type: "underperformance_review", name: "Underperformance Review", description: "Review weak relative performers without assuming why they failed.", defaultWindow: { kind: "last_posts", count: 20 } },
  { type: "monthly_growth_review", name: "Monthly Growth Review", description: "Track output, audience, experiments, recurring signals, and strategic direction over time.", defaultWindow: { kind: "last_days", days: 30 } },
];

export function reportTemplate(type: ReportType): ReportTemplate {
  return REPORT_TEMPLATES.find((template) => template.type === type) ?? REPORT_TEMPLATES[0]!;
}
