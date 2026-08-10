import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { PasteCommentsForm } from "./audience-form";
import { AddToCanvasButton } from "@/components/canvas/add-to-canvas-button";

export default async function AudiencePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: comments } = await supabase
    .from("audience_comments")
    .select("id, body, source, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Audience"
        description="Audience Miner: paste comments manually, or import them when a connected provider exposes authorized comments. Unsupported endpoints are never faked."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <PasteCommentsForm />

        {(comments?.length ?? 0) === 0 ? (
          <EmptyState
            title="No comments stored"
            description="Paste comments from posts you care about. Future clusters and opportunity text will build from this honest corpus."
          />
        ) : (
          <ul className="space-y-3">
            {comments?.map((comment) => (
              <li
                key={comment.id}
                className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4"
              >
                <Badge variant="default">{comment.source.replace(/_/g, " ")}</Badge>
                <p className="mt-2 text-sm leading-relaxed text-on-background">
                  {comment.body}
                </p>
                <div className="mt-3">
                  <AddToCanvasButton
                    nodeType="audience_insight"
                    title={comment.body.slice(0, 80)}
                    body={comment.body}
                    entityId={comment.id}
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
