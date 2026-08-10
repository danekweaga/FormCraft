import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listStyleProfiles } from "@/lib/editing/style-profiles";
import { createClient } from "@/lib/supabase/server";
import { PrePublishForm } from "./pre-publish-form";

type ReviewResult = {
  summary?: string;
  confidenceNote?: string;
  findings?: unknown[];
  checks?: Array<{ id: string; pass: boolean; note: string }>;
};

export default async function PrePublishPage({
  searchParams,
}: {
  searchParams: Promise<{ analysisId?: string }>;
}) {
  const { analysisId: analysisIdParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const [{ data: reviews }, { data: analyses }, { data: posts }, styleProfiles] =
    await Promise.all([
      supabase
        .from("pre_publish_reviews")
        .select(
          "id, source_ref, status, result, created_at, input_text, creative_direction, editing_plan_id",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("video_analyses")
        .select("id, title")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("content_posts")
        .select("id, title")
        .eq("user_id", user.id)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(40),
      listStyleProfiles({ supabase, userId: user.id }),
    ]);

  let defaultTranscript: string | undefined;
  let defaultTitle: string | undefined;
  let defaultAnalysisId = analysisIdParam;
  if (analysisIdParam) {
    const { data: analysis } = await supabase
      .from("video_analyses")
      .select("id, title, transcript")
      .eq("id", analysisIdParam)
      .eq("user_id", user.id)
      .maybeSingle();
    if (analysis) {
      defaultAnalysisId = analysis.id;
      defaultTranscript = analysis.transcript ?? undefined;
      defaultTitle = analysis.title ?? "From Analyze";
    } else {
      defaultAnalysisId = undefined;
    }
  }

  return (
    <div>
      <PageHeader
        title="Pre-Publish"
        description="Stress-test a script before it ships. Findings are bucketed and labeled — Observation, Creative suggestion, Performance evidence, Current experiment."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <PrePublishForm
          analyses={analyses ?? []}
          posts={posts ?? []}
          styleProfiles={styleProfiles.map((p) => ({
            id: p.id,
            name: p.name,
          }))}
          defaultAnalysisId={defaultAnalysisId}
          defaultTranscript={defaultTranscript}
          defaultTitle={defaultTitle}
        />

        {(reviews?.length ?? 0) === 0 ? (
          <EmptyState
            title="No reviews yet"
            description="Paste a draft script for an AI-assisted review grounded in the text you provide."
          />
        ) : (
          <ul className="space-y-3">
            {reviews?.map((review) => {
              const result = (review.result ?? {}) as ReviewResult;
              const findingCount = Array.isArray(result.findings)
                ? result.findings.length
                : result.checks?.filter((c) => !c.pass).length;
              return (
                <li key={review.id}>
                  <Link
                    href={`/pre-publish/${review.id}`}
                    className="block rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow transition hover:border-primary/40"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="primary">{review.status}</Badge>
                      {review.source_ref ? (
                        <Badge variant="default">{review.source_ref}</Badge>
                      ) : null}
                      {review.creative_direction ? (
                        <Badge variant="default">
                          {String(review.creative_direction).replace(/_/g, " ")}
                        </Badge>
                      ) : null}
                      {review.editing_plan_id ? (
                        <Badge variant="success">Editing plan</Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm font-medium text-on-background">
                      {result.summary ?? "Review stored"}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm text-secondary">
                      {review.input_text}
                    </p>
                    <p className="mt-3 text-xs text-secondary">
                      {findingCount != null
                        ? `${findingCount} finding(s)`
                        : null}
                      {result.confidenceNote
                        ? ` · ${result.confidenceNote}`
                        : null}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
