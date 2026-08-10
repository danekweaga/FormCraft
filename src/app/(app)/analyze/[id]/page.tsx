import { notFound, redirect } from "next/navigation";
import { createSignedMediaUrl } from "@/lib/analyze/media/store";
import type { ProcessingStage } from "@/lib/analyze/schema";
import { createClient } from "@/lib/supabase/server";
import { AnalysisDetailClient } from "./analysis-detail";

export default async function AnalyzeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: analysis } = await supabase
    .from("video_analyses")
    .select(
      "id, title, analysis_mode, subject_type, source_type, status, has_visual_evidence, has_audio_evidence, model_name, prompt_version, created_at, result, transcript, storage_path, processing_stages, knowledge_sources, analysis_version, parent_analysis_id, saved, estimated_cost_usd",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!analysis) notFound();

  let mediaUrl: string | null = null;
  if (analysis.storage_path) {
    mediaUrl = await createSignedMediaUrl({
      supabase,
      path: analysis.storage_path,
    });
  }

  const versionRoot = analysis.parent_analysis_id ?? analysis.id;
  const { data: versions } = await supabase
    .from("video_analyses")
    .select("id, analysis_version, created_at, parent_analysis_id")
    .eq("user_id", user.id)
    .or(`id.eq.${versionRoot},parent_analysis_id.eq.${versionRoot}`)
    .order("analysis_version", { ascending: true });

  return (
    <AnalysisDetailClient
      analysis={{
        ...analysis,
        media_url: mediaUrl,
        processing_stages:
          (analysis.processing_stages as ProcessingStage[] | null) ?? [],
        versions: (versions ?? []).map((v) => ({
          id: v.id,
          analysis_version: v.analysis_version ?? 1,
          created_at: v.created_at,
        })),
      }}
    />
  );
}
