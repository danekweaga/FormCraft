import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import type { EditingBlueprint, PrePublishLabResult } from "@/lib/editing/schema";
import { prePublishLabResultSchema } from "@/lib/editing/schema";
import { createClient } from "@/lib/supabase/server";
import { heuristicToLabResult } from "@/lib/growth/pre-publish-lab";
import { PrePublishDetailClient } from "../review-detail";

function normalizeResult(raw: unknown, script: string): PrePublishLabResult {
  const parsed = prePublishLabResultSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const legacy = raw as {
    summary?: string;
    checks?: Array<{ id: string; pass: boolean; note: string }>;
    confidenceNote?: string;
    mode?: "heuristic_stub" | "openrouter_ai";
  };
  return heuristicToLabResult(
    {
      mode: legacy.mode ?? "heuristic_stub",
      summary: legacy.summary ?? "Legacy review",
      checks: legacy.checks ?? [],
      confidenceNote: legacy.confidenceNote ?? "Legacy format",
    },
    script,
  );
}

export default async function PrePublishDetailPage({
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

  const { data: review } = await supabase
    .from("pre_publish_reviews")
    .select(
      "id, status, source_ref, input_text, analysis_id, content_post_id, creative_direction, editing_plan_id, active_experiment_id, result, created_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!review) notFound();

  let blueprint: EditingBlueprint | null = null;
  if (review.editing_plan_id) {
    const { data: plan } = await supabase
      .from("editing_plans")
      .select("plan")
      .eq("id", review.editing_plan_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (plan?.plan) blueprint = plan.plan as EditingBlueprint;
  }

  const { data: experiments } = await supabase
    .from("content_experiments")
    .select("id, hypothesis, status")
    .eq("user_id", user.id)
    .in("status", ["planned", "running"])
    .order("created_at", { ascending: false })
    .limit(12);

  const result = normalizeResult(review.result, review.input_text);

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/pre-publish">← Pre-Publish</Link>
      </Button>
      <PageHeader
        title={review.source_ref || "Pre-Publish review"}
        description="Observation vs creative suggestion vs performance evidence vs current experiment."
      />
      <PrePublishDetailClient
        review={{
          ...review,
          result,
        }}
        blueprint={blueprint}
        experiments={experiments ?? []}
      />
    </div>
  );
}
