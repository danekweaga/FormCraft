import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
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
      "id, hypothesis, primary_variable, primary_metric, status, conclusion_state, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <div>
      <PageHeader
        title="Experiments"
        description="Experiment Lab for controlled content tests. Schema supports variants and conclusions; this scaffold is hypothesis-first with honest empty states."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateExperimentForm />

        {(experiments?.length ?? 0) === 0 ? (
          <EmptyState
            title="No experiments yet"
            description="Log a hypothesis when you are ready to isolate one variable. Results should come from real My Content metrics later — never invented."
          />
        ) : (
          <ul className="space-y-3">
            {experiments?.map((experiment) => (
              <li
                key={experiment.id}
                className="rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge variant="primary">{experiment.status}</Badge>
                  {experiment.primary_variable ? (
                    <Badge variant="default">{experiment.primary_variable}</Badge>
                  ) : null}
                  {experiment.primary_metric ? (
                    <Badge variant="default">{experiment.primary_metric}</Badge>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-on-background">
                  {experiment.hypothesis}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
