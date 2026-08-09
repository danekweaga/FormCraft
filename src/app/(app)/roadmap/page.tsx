import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { CreateMilestoneForm, CreateRoadmapForm } from "./roadmap-forms";

export default async function RoadmapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: roadmaps } = await supabase
    .from("creator_roadmaps")
    .select(
      "id, goal, current_phase, progress_pct, status, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const active = roadmaps?.[0] ?? null;

  const { data: milestones } = active
    ? await supabase
        .from("roadmap_milestones")
        .select(
          "id, title, category, status, source_kind, notes, deadline, sort_order, created_at",
        )
        .eq("roadmap_id", active.id)
        .order("sort_order", { ascending: true })
    : { data: [] };

  return (
    <div>
      <PageHeader
        title="Roadmap"
        description="Aim your creator operating loop. Track a personal goal, phase, and milestones — manual for now; auto and AI-suggested progress stay deferred."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateRoadmapForm />

        {active ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary">{active.status}</Badge>
                <Badge variant="default">{active.current_phase}</Badge>
                <Badge variant="default">{`${active.progress_pct}%`}</Badge>
              </div>
              <h2 className="mt-3 font-headline text-2xl font-semibold text-on-background">
                {active.goal}
              </h2>
              <p className="mt-2 text-sm text-secondary">
                Progress is manual until Experiment Lab and My Content signals
                can update milestones honestly.
              </p>
            </div>

            <CreateMilestoneForm roadmapId={active.id} />

            {(milestones?.length ?? 0) === 0 ? (
              <EmptyState
                title="No milestones yet"
                description="Add a first milestone — for example a content volume target, a Teach FormCraft pack, or an experiment to run."
              />
            ) : (
              <ul className="space-y-3">
                {milestones?.map((milestone) => (
                  <li
                    key={milestone.id}
                    className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="default">{milestone.status}</Badge>
                      <Badge variant="primary">{milestone.source_kind}</Badge>
                      <Badge variant="default">{milestone.category}</Badge>
                    </div>
                    <p className="mt-2 font-medium text-on-background">
                      {milestone.title}
                    </p>
                    {milestone.notes ? (
                      <p className="mt-1 text-sm text-secondary">
                        {milestone.notes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <EmptyState
            title="No roadmap yet"
            description="Create a goal to start Phase A of the Creator Growth loop. Later phases will suggest milestones from real performance — never invented metrics."
          />
        )}
      </div>
    </div>
  );
}
