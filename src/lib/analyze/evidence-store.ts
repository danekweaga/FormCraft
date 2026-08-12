import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisResult } from "./schema";

export async function persistAnalysisEvidence(params: {
  supabase: SupabaseClient;
  userId: string;
  analysisId: string;
  result: AnalysisResult;
}) {
  await params.supabase
    .from("analysis_evidence")
    .delete()
    .eq("analysis_id", params.analysisId)
    .eq("user_id", params.userId);

  const timelineRows = params.result.timeline.slice(0, 60).map((item, index) => ({
    user_id: params.userId,
    analysis_id: params.analysisId,
    evidence_type: "content_observation",
    start_seconds: item.startSeconds,
    end_seconds: item.endSeconds,
    transcript_excerpt: item.transcript.slice(0, 500),
    metadata: {
      evidenceId: `timeline:${index}`,
      kind: "timeline_segment",
      type: item.type,
      purpose: item.purpose,
      assessment: item.assessment,
      observed: false,
      source: "transcript",
    },
  }));
  const findingRows = params.result.evidenceFindings.slice(0, 80).map((finding) => ({
    user_id: params.userId,
    analysis_id: params.analysisId,
    evidence_type: finding.evidenceClass,
    start_seconds: finding.startSeconds,
    end_seconds: finding.endSeconds,
    transcript_excerpt: finding.statement.slice(0, 500),
    metadata: {
      evidenceId: finding.id,
      kind: "analysis_finding",
      title: finding.title,
      evidenceIds: finding.evidenceIds,
      psychologyPrincipleNames: finding.psychologyPrincipleNames,
      confidence: finding.confidence,
      uncertainty: finding.uncertainty,
      suggestedExperiment: finding.suggestedExperiment,
      observed: finding.evidenceClass === "observed",
    },
  }));
  const retentionRows = params.result.observedRetention.map((item, index) => ({
    user_id: params.userId,
    analysis_id: params.analysisId,
    evidence_type: "observed",
    start_seconds: item.startSeconds,
    end_seconds: item.endSeconds,
    transcript_excerpt: null,
    metadata: {
      evidenceId: `retention:${index}`,
      kind: "retention_change",
      note: item.note,
      observed: true,
      source: "platform_analytics",
    },
  }));

  const rows = [...timelineRows, ...findingRows, ...retentionRows];
  if (!rows.length) return;
  const { error } = await params.supabase.from("analysis_evidence").insert(rows);
  if (error) throw new Error(`Could not persist analysis evidence: ${error.message}`);
}

