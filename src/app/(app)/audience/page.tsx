import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { PasteCommentsForm } from "./audience-form";

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
        description="Audience Miner foundation: capture real comments in your own words bank. Clustering and language extraction come later — no fake social APIs."
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
