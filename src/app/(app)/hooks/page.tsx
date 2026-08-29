import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getHookStoryLibrarySummary, HOOK_STORY_LIBRARY_ID } from "@/lib/hooks/starter-library";
import { buildHookLibrary, buildStarterHookLibrary } from "@/lib/library/hook-library";
import { createClient } from "@/lib/supabase/server";
import { installHookStoryLibraryAction } from "./actions";
import { HooksLibrary } from "./hooks-library";

export const maxDuration = 60;

export default async function HooksPage({
  searchParams,
}: {
  searchParams: Promise<{ library?: string; error?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: posts }, { data: research }, { data: analyses }, { data: canvas }, { data: installedLibrary }] = await Promise.all([
    supabase
      .from("content_posts")
      .select("id, title, caption, platform, hook_text, topic, format, views, relative_performance")
      .eq("user_id", user.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(160),
    supabase
      .from("research_items")
      .select("id, title, platform, creator_name, hook_text, topic, analysis, outlier_score")
      .eq("user_id", user.id)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(160),
    supabase
      .from("video_analyses")
      .select("id, title, source_type, content_post_id, research_item_id, result")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("canvas_nodes")
      .select("id, board_id, title, body, node_type, payload, research_item_id")
      .eq("user_id", user.id)
      .in("node_type", ["external_outlier", "source_post", "source", "pattern"])
      .order("created_at", { ascending: false })
      .limit(160),
    supabase
      .from("knowledge_documents")
      .select("id, processing_status, updated_at, metadata")
      .eq("user_id", user.id)
      .contains("metadata", { starter_pack_id: HOOK_STORY_LIBRARY_ID })
      .limit(1)
      .maybeSingle(),
  ]);

  const extractedItems = buildHookLibrary({
    posts: posts ?? [],
    research: research ?? [],
    analyses: analyses ?? [],
    canvas: canvas ?? [],
  });
  const starterItems = buildStarterHookLibrary();
  const summary = getHookStoryLibrarySummary();
  const installedVersion =
    installedLibrary?.metadata && typeof installedLibrary.metadata === "object"
      ? String((installedLibrary.metadata as Record<string, unknown>).starter_pack_version ?? "")
      : "";
  const libraryIsCurrent = installedVersion === summary.version;
  const items = [...starterItems, ...extractedItems];

  return (
    <div>
      <PageHeader
        title="Hook library"
        description="Search FormCraft's complete hook and story starter library beside hooks extracted from your content and research. Templates stay separate from measured performance evidence."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">{starterItems.length} templates</Badge>
            <Badge variant="default">v{summary.version}</Badge>
            <Badge variant="default">{extractedItems.length} evidence-backed</Badge>
            <form action={installHookStoryLibraryAction}>
              <Button type="submit" size="sm" variant={installedLibrary ? "outline" : "default"}>
                {libraryIsCurrent
                  ? "Refresh taught library"
                  : installedLibrary
                    ? `Upgrade taught library to v${summary.version}`
                    : "Teach FormCraft this library"}
              </Button>
            </form>
          </div>
        }
      />
      {query.library === "installed" ? (
        <div className="mb-4 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-on-background">
          Hook + Story Library v{summary.version} is indexed in Teach FormCraft and enabled for AI context.
        </div>
      ) : null}
      {query.error ? (
        <div className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {query.error}
        </div>
      ) : null}
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Canonical hooks", summary.canonicalHooks],
          ["Story structures", summary.architectures],
          ["Rehooks", summary.rehooks],
          ["Attention anchors", summary.attentionAnchors],
          ["Viral swipe hooks", summary.viralSwipeHooks],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4 paper-shadow">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{label}</p>
            <p className="mt-1 font-headline text-2xl font-bold text-on-background">{value}</p>
          </div>
        ))}
      </section>
      <p className="mb-4 text-xs leading-relaxed text-secondary">
        Starter templates are creator frameworks to adapt and test. They never count as proof, platform rules, or guaranteed performance. FormCraft still requires truthful claims, matching payoff, and real evidence where a hook needs it.
      </p>
      <HooksLibrary items={items} />
    </div>
  );
}
