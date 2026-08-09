import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { PrePublishForm } from "./pre-publish-form";

type ReviewResult = {
  summary?: string;
  confidenceNote?: string;
  checks?: Array<{ id: string; pass: boolean; note: string }>;
};

export default async function PrePublishPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: reviews } = await supabase
    .from("pre_publish_reviews")
    .select("id, source_ref, status, result, created_at, input_text")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <PageHeader
        title="Pre-Publish"
        description="Stress-test a script before it ships. OpenRouter uses your selected Pre-publish model and falls back to transparent baseline checks when AI is unavailable."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <PrePublishForm />

        {(reviews?.length ?? 0) === 0 ? (
          <EmptyState
            title="No reviews yet"
            description="Paste a draft script for an AI-assisted review grounded in the text you provide."
          />
        ) : (
          <ul className="space-y-3">
            {reviews?.map((review) => {
              const result = (review.result ?? {}) as ReviewResult;
              return (
                <li
                  key={review.id}
                  className="rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="primary">{review.status}</Badge>
                    {review.source_ref ? (
                      <Badge variant="default">{review.source_ref}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-medium text-on-background">
                    {result.summary ?? "Review stored"}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm text-secondary">
                    {review.input_text}
                  </p>
                  {result.confidenceNote ? (
                    <p className="mt-3 text-xs leading-relaxed text-secondary">
                      {result.confidenceNote}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
