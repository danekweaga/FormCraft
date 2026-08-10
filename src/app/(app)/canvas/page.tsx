import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SYSTEM_CANVAS_TEMPLATES } from "@/lib/canvas/templates";
import { createClient } from "@/lib/supabase/server";
import {
  createBlankBoardAction,
  createBoardFromSavedTemplateAction,
  createBoardFromTemplateAction,
  deleteSavedTemplateAction,
} from "./actions";

export default async function CanvasIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: boards }, { data: savedTemplates }] = await Promise.all([
    supabase
      .from("canvas_boards")
      .select("id, title, description, template_key, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("canvas_templates")
      .select("id, name, description, created_at")
      .eq("user_id", user.id)
      .eq("is_system", false)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div>
      <PageHeader
        title="Canvas"
        description="Connect research, ideas, scripts, analyses, and experiments in one visual workspace."
        actions={
          <form action={createBlankBoardAction}>
            <input type="hidden" name="title" value="Untitled board" />
            <Button type="submit">New board</Button>
          </form>
        }
      />

      {(boards?.length ?? 0) === 0 ? (
        <EmptyState
          title="No boards yet"
          description="Start from a template or create a blank board. Add items from Research, Analyze, My Content, and more."
        />
      ) : (
        <ul className="mb-8 grid gap-3 sm:grid-cols-2">
          {boards?.map((b) => (
            <li key={b.id}>
              <Link
                href={`/canvas/${b.id}`}
                className="block rounded-xl border border-outline-variant/20 bg-surface-primary p-4 paper-shadow transition hover:border-primary/40"
              >
                <div className="flex flex-wrap gap-2">
                  {b.template_key ? (
                    <Badge variant="primary">{b.template_key}</Badge>
                  ) : null}
                </div>
                <p className="mt-2 font-semibold text-on-background">{b.title}</p>
                {b.description ? (
                  <p className="mt-1 text-sm text-secondary">{b.description}</p>
                ) : null}
                <p className="mt-2 text-xs text-secondary">
                  Updated {new Date(b.updated_at).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-3 font-headline text-lg font-semibold">Templates</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SYSTEM_CANVAS_TEMPLATES.map((t) => (
          <li
            key={t.key}
            className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4"
          >
            <p className="font-semibold text-on-background">{t.name}</p>
            <p className="mt-1 text-sm text-secondary">{t.description}</p>
            <form action={createBoardFromTemplateAction} className="mt-3">
              <input type="hidden" name="templateKey" value={t.key} />
              <Button type="submit" size="sm" variant="outline">
                Use template
              </Button>
            </form>
          </li>
        ))}
      </ul>

      <h2 className="mb-3 mt-8 font-headline text-lg font-semibold">
        Your templates
      </h2>
      {(savedTemplates?.length ?? 0) === 0 ? (
        <p className="text-sm text-secondary">
          Open a board and choose Save as template to reuse your own workflow.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {savedTemplates?.map((template) => (
            <li
              key={template.id}
              className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4"
            >
              <p className="font-semibold text-on-background">{template.name}</p>
              {template.description ? (
                <p className="mt-1 text-sm text-secondary">
                  {template.description}
                </p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <form action={createBoardFromSavedTemplateAction}>
                  <input type="hidden" name="templateId" value={template.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Use template
                  </Button>
                </form>
                <form action={deleteSavedTemplateAction}>
                  <input type="hidden" name="templateId" value={template.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
