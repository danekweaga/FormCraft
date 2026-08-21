import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import {
  buildDataQuality,
  buildMetricGroups,
  reportFormat,
  reportHook,
  reportTopic,
} from "./metrics";
import { reportTemplate } from "./templates";
import type {
  ReportAction,
  ReportConfidence,
  ReportEvidence,
  ReportFinding,
  ReportResult,
  ReportRunRow,
  ReportType,
  ReportWindow,
} from "./types";

const synthesisSchema = z.object({
  summary: z.string().max(900),
  interpretations: z.array(z.string().max(500)).max(8),
  contradictoryEvidence: z.array(z.string().max(500)).max(6),
  cannotConclude: z.array(z.string().max(500)).max(8),
  recommendedActions: z.array(z.string().max(500)).max(8),
});

type Synthesis = z.infer<typeof synthesisSchema>;

function asWindow(value: unknown, fallback: ReportWindow): ReportWindow {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  if (record.kind === "last_posts" && [10, 20, 30].includes(Number(record.count))) {
    return { kind: "last_posts", count: Number(record.count) as 10 | 20 | 30 };
  }
  if (record.kind === "last_days" && [30, 90].includes(Number(record.days))) {
    return { kind: "last_days", days: Number(record.days) as 30 | 90 };
  }
  if (record.kind === "custom" && typeof record.start === "string" && typeof record.end === "string") {
    return { kind: "custom", start: record.start, end: record.end };
  }
  return fallback;
}

function windowDates(window: ReportWindow): { start: string | null; end: string } {
  const end = window.kind === "custom" ? new Date(window.end).toISOString() : new Date().toISOString();
  if (window.kind === "last_days") {
    return { start: new Date(Date.now() - window.days * 86_400_000).toISOString(), end };
  }
  return { start: window.kind === "custom" ? new Date(window.start).toISOString() : null, end };
}

function postLabel(post: ContentPostRow): string {
  return post.title?.trim() || post.caption?.trim().slice(0, 100) || "Untitled post";
}

function findingsFromGroups(
  groups: ReturnType<typeof buildMetricGroups>,
  dimension: string,
  evidence: ReportEvidence[],
): ReportFinding[] {
  return groups
    .filter((group) => group.medianRelativeViews != null && group.sampleSize > 0)
    .slice(0, 3)
    .map((group, index) => {
      const id = `${dimension}-${index + 1}`;
      for (const item of evidence) {
        if (group.supportingPostIds.includes(item.sourceId)) item.findingId = id;
      }
      return {
        id,
        title: `${group.label} ${dimension}`,
        observation: `${group.label} has ${group.sampleSize} post${group.sampleSize === 1 ? "" : "s"} and a ${group.medianRelativeViews!.toFixed(2)}× median view index.`,
        interpretation:
          group.sampleSize < 3
            ? "Treat this as an early signal and run a controlled test."
            : group.medianRelativeViews! >= 1
              ? "This is outperforming the selected account baseline, but the topic, hook, and format may be interacting."
              : "This trails the selected account baseline; the report cannot assign a cause from correlation alone.",
        confidence: group.confidence,
        evidenceIds: group.supportingPostIds,
        contradictoryEvidenceIds: group.contradictoryPostIds,
      };
    });
}

export async function generateReportRun(params: {
  supabase: SupabaseClient;
  userId: string;
  definitionId: string;
  window?: ReportWindow | Record<string, unknown>;
  trigger?: "manual" | "scheduled";
}): Promise<ReportRunRow> {
  const { data: definition, error: definitionError } = await params.supabase
    .from("report_definitions")
    .select("*")
    .eq("id", params.definitionId)
    .eq("user_id", params.userId)
    .single();
  if (definitionError || !definition) throw definitionError ?? new Error("Report definition not found");

  const type = definition.report_type as ReportType;
  const template = reportTemplate(type);
  const configured = (definition.configuration as Record<string, unknown>)?.defaultWindow;
  const window = asWindow(params.window ?? configured, template.defaultWindow);
  const dates = windowDates(window);
  const { data: inserted, error: insertError } = await params.supabase
    .from("report_runs")
    .insert({
      user_id: params.userId,
      report_definition_id: params.definitionId,
      report_type: type,
      status: "queued",
      progress: { step: "queued", trigger: params.trigger ?? "manual" },
      period_start: dates.start,
      period_end: dates.end,
      data_window: window,
    })
    .select("*")
    .single();
  if (insertError || !inserted) throw insertError ?? new Error("Could not create report run");
  const runId = inserted.id as string;

  try {
    await params.supabase.from("report_runs").update({ status: "collecting_data", progress: { step: "collecting_data" } }).eq("id", runId);
    let postsQuery = params.supabase
      .from("content_posts")
      .select("*")
      .eq("user_id", params.userId)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false });
    if (window.kind === "last_posts") postsQuery = postsQuery.limit(window.count);
    else postsQuery = postsQuery.gte("published_at", dates.start!).lte("published_at", dates.end).limit(100);
    const { data: postRows, error: postsError } = await postsQuery;
    if (postsError) throw postsError;
    const posts = (postRows ?? []) as ContentPostRow[];
    const postIds = posts.map((post) => post.id);

    const [commentsResult, insightsResult, experimentsResult, roadmapResult, lessonsResult, researchResult, psychologyResult] = await Promise.all([
      postIds.length
        ? params.supabase.from("audience_comments").select("id,body,post_id,created_at").eq("user_id", params.userId).in("post_id", postIds).limit(500)
        : Promise.resolve({ data: [], error: null }),
      params.supabase.from("audience_insights").select("id,insight_type,summary,sample_size,confidence,source_post_ids").eq("user_id", params.userId).eq("status", "active").limit(30),
      params.supabase.from("content_experiments").select("id,hypothesis,status,post_ids,metrics,result,conclusion").eq("user_id", params.userId).order("updated_at", { ascending: false }).limit(20),
      params.supabase.from("creator_roadmaps").select("id,goal,current_phase,progress_pct,status").eq("user_id", params.userId).eq("status", "active").limit(10),
      params.supabase.from("performance_lessons").select("id,lesson,confidence,sample_size,status").eq("user_id", params.userId).in("status", ["supported", "testing", "confirmed"]).limit(20),
      params.supabase.from("research_items").select("id,title,topic,outlier_score,external_url,platform").eq("user_id", params.userId).or("saved.eq.true,outlier_score.gte.2").order("outlier_score", { ascending: false }).limit(20),
      params.supabase.from("psychology_principles").select("id,name,content_application,evidence_strength,limitations").eq("user_id", params.userId).eq("status", "active").limit(5),
    ]);
    const queryErrors = [commentsResult.error, insightsResult.error, experimentsResult.error, roadmapResult.error, lessonsResult.error, researchResult.error, psychologyResult.error].filter(Boolean);
    if (queryErrors.length) throw queryErrors[0];

    await params.supabase.from("report_runs").update({ status: "calculating", progress: { step: "calculating" } }).eq("id", runId);
    const comments = commentsResult.data ?? [];
    const topicGroups = buildMetricGroups(posts, reportTopic);
    const hookGroups = buildMetricGroups(posts, reportHook);
    const formatGroups = buildMetricGroups(posts, reportFormat);
    const dataQuality = buildDataQuality(posts, new Set(comments.map((comment) => comment.post_id).filter(Boolean)).size);
    const evidence: ReportEvidence[] = posts.map((post) => ({
      findingId: "source-post",
      direction: "supporting",
      sourceType: "post",
      sourceId: post.id,
      label: postLabel(post),
      excerpt: post.caption?.slice(0, 240) ?? undefined,
      metrics: { views: post.views ?? null, shares: post.shares ?? null, saves: post.saves ?? null, comments: post.comments ?? null },
      href: `/my-content/${post.id}`,
    }));
    evidence.push(
      ...comments.slice(0, 50).map((comment) => ({ findingId: "audience-language", direction: "context" as const, sourceType: "comment" as const, sourceId: comment.id, label: "Audience comment", excerpt: comment.body.slice(0, 240), href: "/audience" })),
      ...(insightsResult.data ?? []).map((insight) => ({ findingId: "audience-demand", direction: "supporting" as const, sourceType: "audience_insight" as const, sourceId: insight.id, label: insight.summary, metrics: { sampleSize: insight.sample_size ?? 0, confidence: insight.confidence }, href: "/audience" })),
      ...(experimentsResult.data ?? []).map((experiment) => ({ findingId: "experiment-context", direction: "context" as const, sourceType: "experiment" as const, sourceId: experiment.id, label: experiment.hypothesis, excerpt: experiment.conclusion ?? experiment.result ?? undefined, metrics: { postCount: Array.isArray(experiment.post_ids) ? experiment.post_ids.length : 0 }, href: "/experiments" })),
      ...(roadmapResult.data ?? []).map((roadmap) => ({ findingId: "roadmap-context", direction: "context" as const, sourceType: "roadmap" as const, sourceId: roadmap.id, label: roadmap.goal, metrics: { progressPct: Number(roadmap.progress_pct ?? 0) }, href: "/roadmap" })),
      ...(lessonsResult.data ?? []).map((lesson) => ({ findingId: "learned-pattern", direction: "context" as const, sourceType: "lesson" as const, sourceId: lesson.id, label: lesson.lesson, metrics: { confidence: lesson.confidence, sampleSize: lesson.sample_size }, href: "/performance" })),
      ...(researchResult.data ?? []).map((item) => ({ findingId: "market-context", direction: "context" as const, sourceType: "research" as const, sourceId: item.id, label: item.title ?? item.topic ?? "Research evidence", metrics: { outlierScore: item.outlier_score }, href: item.external_url ?? "/research" })),
      ...(psychologyResult.data ?? []).map((principle) => ({ findingId: "psychology-context", direction: "context" as const, sourceType: "psychology" as const, sourceId: principle.id, label: principle.name, excerpt: principle.content_application ?? undefined, metrics: { evidenceStrength: principle.evidence_strength }, href: "/psychology" })),
    );
    const findings = [
      ...findingsFromGroups(topicGroups, "topic", evidence),
      ...findingsFromGroups(hookGroups, "hook", evidence),
      ...findingsFromGroups(formatGroups, "format", evidence),
    ];
    const observedData = [
      `${posts.length} eligible posts were analyzed; ${dataQuality.postsWithMetrics} include performance metrics.`,
      `Metric coverage is ${dataQuality.metricsCoveragePct}% and freshness is ${dataQuality.freshness}.`,
      `${comments.length} linked audience comments and ${(insightsResult.data ?? []).length} active audience insights were available.`,
    ];
    const patterns = findings.slice(0, 6).map((finding) => finding.observation);
    const contradictory = findings
      .filter((finding) => finding.contradictoryEvidenceIds.length)
      .map((finding) => `${finding.title} includes ${finding.contradictoryEvidenceIds.length} below-baseline counterexample${finding.contradictoryEvidenceIds.length === 1 ? "" : "s"}.`);
    const cannot = [
      "Correlation in this report does not prove why a post performed differently.",
      ...(dataQuality.retentionAvailable ? [] : ["The report cannot conclude where viewers dropped off without retention metrics."]),
      ...(comments.length ? [] : ["The report cannot infer audience language or demand without linked comments."]),
      ...(posts.length >= 5 ? [] : ["The report cannot establish stable patterns from fewer than five eligible posts."]),
    ];
    const actions: ReportAction[] = [
      { label: "Turn the strongest signal into a sprint", href: "/research?mode=signals", kind: "signal_sprint" },
      { label: "Create a controlled experiment", href: "/experiments", kind: "experiment" },
      { label: "Build evidence-backed ideas", href: "/create", kind: "ideas" },
      { label: "Review your creator roadmap", href: "/roadmap", kind: "roadmap" },
    ];
    const deterministic: Synthesis = {
      summary: posts.length
        ? `This ${template.name.toLowerCase()} analyzed ${posts.length} posts. The strongest signals are directional and should be validated with controlled experiments.`
        : `No eligible published posts were found for this window. Add or sync posts before drawing strategic conclusions.`,
      interpretations: findings.slice(0, 6).map((finding) => finding.interpretation),
      contradictoryEvidence: contradictory,
      cannotConclude: cannot,
      recommendedActions: actions.map((action) => action.label),
    };
    const snapshot = {
      posts: posts.map((post) => ({ id: post.id, views: post.views, shares: post.shares, saves: post.saves, comments: post.comments, topic: reportTopic(post), hook: reportHook(post), format: reportFormat(post), metrics_refreshed_at: post.metrics_refreshed_at })),
      audienceInsightIds: (insightsResult.data ?? []).map((row) => row.id),
      experimentIds: (experimentsResult.data ?? []).map((row) => row.id),
      roadmapIds: (roadmapResult.data ?? []).map((row) => row.id),
    };
    const snapshotHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

    await params.supabase.from("report_runs").update({ status: "analyzing", progress: { step: "analyzing" }, data_snapshot: snapshot, data_snapshot_hash: snapshotHash }).eq("id", runId);
    const ai = posts.length
      ? await tryStructuredAI({
          supabase: params.supabase,
          fallback: deterministic,
          input: {
            userId: params.userId,
            taskType: "report_synthesis",
            role: "standard",
            promptVersion: "reports-v1",
            cacheKey: hashAiInput([type, window, snapshotHash, "reports-v1"]),
            schema: synthesisSchema,
            temperature: 0.2,
            maxOutputTokens: 1800,
            messages: [{ role: "user", content: `Explain this deterministic report without inventing causes, metrics, or facts. Distinguish observation from interpretation. Return JSON only.\n${JSON.stringify({ observedData, patterns, contradictory, cannot, dataQuality, topicGroups: topicGroups.slice(0, 8), hookGroups, formatGroups })}` }],
          },
        })
      : { data: deterministic, model: "none", usedLlm: false };

    const result: ReportResult = {
      version: 1,
      reportType: type,
      title: template.name,
      summary: ai.data.summary,
      observedData,
      patterns,
      aiInterpretation: ai.data.interpretations,
      contradictoryEvidence: ai.data.contradictoryEvidence,
      cannotConclude: ai.data.cannotConclude,
      recommendedActions: ai.data.recommendedActions,
      dataQuality,
      topicGroups,
      hookGroups,
      formatGroups,
      audienceSignals: (insightsResult.data ?? []).map((row) => ({ id: row.id, type: row.insight_type, summary: row.summary, sampleSize: row.sample_size ?? 0, confidence: (row.confidence ?? "low") as ReportConfidence })),
      emergingSignals: topicGroups.filter((group) => group.label !== "Unclassified").slice(0, 8).map((group) => ({ id: group.key, label: group.label, audienceDemand: group.conversationSignal === "strong" ? "strong" : group.conversationSignal === "mixed" ? "moderate" : "weak", creatorInterest: group.sampleSize >= 3 ? "strong" : group.sampleSize ? "moderate" : "unknown", crossPostEvidence: group.sampleSize, recommendation: group.sampleSize < 3 ? "Test this signal in a small sprint before committing." : "Develop one controlled follow-up that keeps the topic and changes one creative variable." })),
      experiments: (experimentsResult.data ?? []).map((row) => ({ id: row.id, hypothesis: row.hypothesis, status: row.status, postCount: Array.isArray(row.post_ids) ? row.post_ids.length : 0, evidenceStrength: Array.isArray(row.post_ids) && row.post_ids.length >= 5 ? "high" : Array.isArray(row.post_ids) && row.post_ids.length >= 2 ? "medium" : "low", uncertainty: row.conclusion ? "Review whether the conclusion survives new posts." : "Not enough concluded evidence yet." })),
      roadmap: (roadmapResult.data ?? []).map((row) => ({ id: row.id, goal: row.goal, phase: row.current_phase, progressPct: Number(row.progress_pct ?? 0), suggestion: "Compare this goal with the strongest current topic and audience signals." })),
      psychologyContext: (psychologyResult.data ?? []).map((row) => ({ id: row.id, principle: row.name, application: row.content_application ?? "No application recorded.", evidenceStrength: row.evidence_strength, limitation: row.limitations ?? "Apply cautiously and test with your audience." })),
      findings,
      evidence,
      actions,
      provenance: { sourceCounts: { posts: posts.length, comments: comments.length, audienceInsights: (insightsResult.data ?? []).length, experiments: (experimentsResult.data ?? []).length, roadmaps: (roadmapResult.data ?? []).length, lessons: (lessonsResult.data ?? []).length, research: (researchResult.data ?? []).length, psychology: (psychologyResult.data ?? []).length }, metricsUsed: ["median relative views", "median shares", "median saves", "median comments", "median engagement rate", "sample size", "freshness"], snapshotHash },
    };
    const finalStatus = posts.length >= 5 ? "ready" : "partial";
    const { data: completed, error: completeError } = await params.supabase.from("report_runs").update({ status: finalStatus, progress: { step: finalStatus }, result, source_ids: { posts: postIds, comments: comments.map((row) => row.id), audienceInsights: (insightsResult.data ?? []).map((row) => row.id), experiments: (experimentsResult.data ?? []).map((row) => row.id), roadmaps: (roadmapResult.data ?? []).map((row) => row.id) }, metrics_used: result.provenance.metricsUsed, model: ai.model, prompt_version: "reports-v1", confidence: dataQuality.confidence, generated_at: new Date().toISOString() }).eq("id", runId).select("*").single();
    if (completeError || !completed) throw completeError ?? new Error("Could not save report");
    if (evidence.length) {
      await params.supabase.from("report_run_evidence").insert(evidence.map((item) => ({ report_run_id: runId, user_id: params.userId, finding_id: item.findingId, direction: item.direction, source_type: item.sourceType, source_id: item.sourceId, label: item.label, excerpt: item.excerpt ?? null, metrics: item.metrics ?? {}, href: item.href ?? null })));
    }
    return completed as ReportRunRow;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report generation failed";
    await params.supabase.from("report_runs").update({ status: "failed", progress: { step: "failed" }, error_code: "generation_failed", error_message: message.slice(0, 500) }).eq("id", runId);
    throw error;
  }
}
