import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { AnalysisList, AnalyzeForm } from "./analyze-form";

export default async function AnalyzePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: analyses } = await supabase
    .from("video_analyses")
    .select(
      "id, title, analysis_mode, subject_type, status, has_visual_evidence, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <PageHeader
        title="Video Breakdown Lab"
        description="Paste a transcript for an OpenRouter-powered script breakdown using your selected Content analysis model. Visual claims remain disabled without visual evidence."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyzeForm />
        {(analyses?.length ?? 0) > 0 ? (
          <AnalysisList analyses={analyses ?? []} />
        ) : (
          <EmptyState
            title="No analyses yet"
            description="Your first transcript analysis will appear here after you run a breakdown."
          />
        )}
      </div>
    </div>
  );
}
