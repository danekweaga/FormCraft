import { notFound, redirect } from "next/navigation";
import type { AnalysisResult } from "@/lib/analyze/schema";
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
      "id, title, analysis_mode, subject_type, status, has_visual_evidence, model_name, created_at, result",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!analysis) notFound();

  return (
    <AnalysisDetailClient
      analysis={{
        ...analysis,
        result: analysis.result as AnalysisResult | null,
      }}
    />
  );
}
