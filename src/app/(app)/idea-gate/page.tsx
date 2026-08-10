import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AddToCanvasButton } from "@/components/canvas/add-to-canvas-button";
import { createClient } from "@/lib/supabase/server";
import { IdeaGateForm } from "./idea-gate-form";

export default async function IdeaGatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: evaluations } = await supabase
    .from("idea_gate_evaluations")
    .select(
      "id, idea_text, recommendation, why, missing_ingredient, better_angle, best_format, status, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <PageHeader
        title="Idea Gate"
        description="Decide what deserves production time. Heuristic recommendations persist now; Knowledge- and performance-aware AI stays deferred."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <IdeaGateForm />

        {(evaluations?.length ?? 0) === 0 ? (
          <EmptyState
            title="No evaluations yet"
            description="Gate your next idea before drafting in Create. Recommendations are local heuristics until the LLM path ships."
          />
        ) : (
          <ul className="space-y-3">
            {evaluations?.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge variant="primary">{item.recommendation}</Badge>
                  <Badge variant="default">{item.status}</Badge>
                  {item.best_format ? (
                    <Badge variant="default">{item.best_format}</Badge>
                  ) : null}
                </div>
                <p className="mt-3 text-sm font-medium text-on-background">
                  {item.idea_text}
                </p>
                {item.why ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">
                    {item.why}
                  </p>
                ) : null}
                {item.missing_ingredient ? (
                  <p className="mt-2 text-xs text-secondary">
                    Missing: {item.missing_ingredient}
                  </p>
                ) : null}
                {item.better_angle ? (
                  <p className="mt-1 text-xs text-secondary">
                    Better angle: {item.better_angle}
                  </p>
                ) : null}
                <div className="mt-3">
                  <AddToCanvasButton
                    nodeType="idea"
                    title={item.idea_text.slice(0, 80)}
                    body={[item.why, item.better_angle].filter(Boolean).join("\n")}
                    entityId={item.id}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
