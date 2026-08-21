export const REPORT_TYPES = [
  "content_strategy_audit",
  "weekly_content_review",
  "audience_demand_report",
  "signal_finder_report",
  "hook_report",
  "format_report",
  "experiment_report",
  "content_pillar_report",
  "roadmap_progress_report",
  "winner_breakdown_report",
  "underperformance_review",
  "monthly_growth_review",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportFrequency = "manual" | "daily" | "weekly" | "monthly";
export type ReportRunStatus =
  | "queued"
  | "collecting_data"
  | "calculating"
  | "analyzing"
  | "ready"
  | "partial"
  | "failed";
export type ReportConfidence = "low" | "medium" | "high";

export type ReportWindow =
  | { kind: "last_posts"; count: 10 | 20 | 30 }
  | { kind: "last_days"; days: 30 | 90 }
  | { kind: "custom"; start: string; end: string };

export type ReportEvidence = {
  findingId: string;
  direction: "supporting" | "contradictory" | "context";
  sourceType:
    | "post"
    | "comment"
    | "audience_insight"
    | "experiment"
    | "signal"
    | "roadmap"
    | "lesson"
    | "research"
    | "psychology"
    | "profile";
  sourceId: string;
  label: string;
  excerpt?: string;
  metrics?: Record<string, number | string | null>;
  href?: string;
};

export type ReportMetricGroup = {
  key: string;
  label: string;
  sampleSize: number;
  medianRelativeViews: number | null;
  medianShares: number | null;
  medianSaves: number | null;
  medianComments: number | null;
  medianEngagementRate: number | null;
  conversationSignal: "unavailable" | "weak" | "mixed" | "strong";
  confidence: ReportConfidence;
  supportingPostIds: string[];
  contradictoryPostIds: string[];
};

export type ReportDataQuality = {
  eligiblePosts: number;
  postsWithMetrics: number;
  metricsCoveragePct: number;
  hookClassifications: number;
  formatClassifications: number;
  topicClassifications: number;
  postsWithAudienceComments: number;
  retentionAvailable: number;
  newestMetricAt: string | null;
  freshness: "fresh" | "aging" | "stale" | "unknown";
  warnings: string[];
  confidence: ReportConfidence;
};

export type ReportFinding = {
  id: string;
  title: string;
  observation: string;
  interpretation: string;
  confidence: ReportConfidence;
  evidenceIds: string[];
  contradictoryEvidenceIds: string[];
};

export type ReportAction = {
  label: string;
  href: string;
  kind:
    | "signal_sprint"
    | "experiment"
    | "ideas"
    | "roadmap"
    | "winner"
    | "weak_post"
    | "watchlist"
    | "pattern"
    | "series"
    | "canvas"
    | "profile";
};

export type ReportResult = {
  version: 1;
  reportType: ReportType;
  title: string;
  summary: string;
  observedData: string[];
  patterns: string[];
  aiInterpretation: string[];
  contradictoryEvidence: string[];
  cannotConclude: string[];
  recommendedActions: string[];
  dataQuality: ReportDataQuality;
  topicGroups: ReportMetricGroup[];
  hookGroups: ReportMetricGroup[];
  formatGroups: ReportMetricGroup[];
  audienceSignals: Array<{
    id: string;
    type: string;
    summary: string;
    sampleSize: number;
    confidence: ReportConfidence;
  }>;
  emergingSignals: Array<{
    id: string;
    label: string;
    audienceDemand: "weak" | "moderate" | "strong";
    creatorInterest: "unknown" | "moderate" | "strong";
    crossPostEvidence: number;
    recommendation: string;
  }>;
  experiments: Array<{
    id: string;
    hypothesis: string;
    status: string;
    postCount: number;
    evidenceStrength: ReportConfidence;
    uncertainty: string;
  }>;
  roadmap: Array<{
    id: string;
    goal: string;
    phase: string;
    progressPct: number;
    suggestion: string;
  }>;
  psychologyContext: Array<{
    id: string;
    principle: string;
    application: string;
    evidenceStrength: string;
    limitation: string;
  }>;
  findings: ReportFinding[];
  evidence: ReportEvidence[];
  actions: ReportAction[];
  provenance: {
    sourceCounts: Record<string, number>;
    metricsUsed: string[];
    snapshotHash: string;
  };
};

export type ReportDefinitionRow = {
  id: string;
  user_id: string;
  report_type: ReportType;
  name: string;
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ReportScheduleRow = {
  id: string;
  user_id: string;
  report_definition_id: string;
  frequency: ReportFrequency;
  timezone: string;
  schedule_config: Record<string, unknown>;
  delivery_preferences: Record<string, boolean>;
  email_enabled: boolean;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  consecutive_failures: number;
  last_error: string | null;
};

export type ReportRunRow = {
  id: string;
  user_id: string;
  report_definition_id: string;
  report_type: ReportType;
  status: ReportRunStatus;
  progress: Record<string, unknown>;
  period_start: string | null;
  period_end: string | null;
  data_window: Record<string, unknown>;
  data_snapshot: Record<string, unknown>;
  data_snapshot_hash: string | null;
  result: ReportResult | Record<string, never>;
  source_ids: Record<string, string[]>;
  metrics_used: string[];
  model: string | null;
  prompt_version: string | null;
  confidence: ReportConfidence | null;
  error_code: string | null;
  error_message: string | null;
  generated_at: string | null;
  created_at: string;
};
