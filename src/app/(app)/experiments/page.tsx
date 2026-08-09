import { redirect } from "next/navigation";
import { IntelligenceExplanation } from "@/components/intelligence/intelligence-explanation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { interpretExperimentAggregate } from "@/lib/intelligence/experiment-interpret";
import { computeExperimentAggregate } from "@/lib/intelligence/experiment-stats";
import { createClient } from "@/lib/supabase/server";
import { AttachPostForm } from "./attach-post-form";
import { CreateExperimentForm } from "./experiment-form";

export default async function ExperimentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: experiments } = await supabase
    .from("content_experiments")
    .select(
      "id, hypothesis, primary_variable, primary_metric, status, conclusion_state, post_ids, metrics, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);

  const { data: posts } = await supabase
    .from("content_posts")
    .select("id, title, caption, platform, source_label, published_at")
    .eq("user_id", user.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(80);

  const postOptions = (posts ?? []).map((post) => ({
    id: post.id,
    label: `${post.platform} · ${(post.title || post.caption || "Untitled").slice(0, 48)} · ${post.source_label}`,
  }));

  const aggregates = await Promise.all(
    (experiments ?? []).map(async (experiment) => {
      const stats = await computeExperimentAggregate({
        supabase,
        userId: user.id,
        postIds: (experiment.post_ids as string[]) ?? [],
      });
      const interpretation = await interpretExperimentAggregate({
        supabase,
        userId: user.id,
        hypothesis: experiment.hypothesis,
        aggregate: stats,
      });
      return { id: experiment.id, stats, interpretation };
    }),
  );
  const statsById = new Map(
    aggregates.map((a) => [
      a.id,
      { stats: a.stats, interpretation: a.interpretation },
    ]),
  );

  return (
    <div>
      <PageHeader
        title="Experiments"
        description="Experiments reference canonical My Content posts. When Instagram syncs, attached post metrics refresh automatically."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateExperimentForm />

        {(experiments?.length ?? 0) === 0 ? (
          <EmptyState
            title="No experiments yet"
            description="Log a hypothesis, then attach synced or manual posts. FormCraft will not auto-assign variants."
          />
        ) : (
          <ul className="space-y-4">
            {experiments?.map((experiment) => {
              const bundle = statsById.get(experiment.id);
              const stats = bundle?.stats;
              const interpretation = bundle?.interpretation;
              return (
                <li key={experiment.id} className="space-y-3">
                  <div className="rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="primary">{experiment.status}</Badge>
                      {experiment.primary_variable ? (
                        <Badge variant="default">
                          {experiment.primary_variable}
                        </Badge>
                      ) : null}
                      <Badge variant="default">
                        {stats?.postCount ?? 0} posts
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-on-background">
                      {experiment.hypothesis}
                    </p>
                    <AttachPostForm
                      experimentId={experiment.id}
                      posts={postOptions}
                    />
                  </div>
                  {stats && interpretation ? (
                    <IntelligenceExplanation
                      title="Current observation"
                      suggestedAction={interpretation.observation}
                      confidence={interpretation.confidence}
                      why={[interpretation.recommendation]}
                      evidence={[
                        `Median views: ${stats.medianViews ?? "unavailable"}`,
                        `Median relative views: ${stats.medianRelativeViews?.toFixed(2) ?? "unavailable"}×`,
                        `Median comments: ${stats.medianComments ?? "unavailable"}`,
                        `Median shares: ${stats.medianShares ?? "unavailable"}`,
                        `Median saves: ${stats.medianSaves ?? "unavailable"}`,
                      ]}
                      contradictory={interpretation.contradictoryEvidence}
                      sources={[
                        "My Content canonical metrics",
                        "Personal baseline",
                        interpretation.usedLlm
                          ? "STANDARD AI interpretation"
                          : "Deterministic aggregate",
                      ]}
                    />
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
