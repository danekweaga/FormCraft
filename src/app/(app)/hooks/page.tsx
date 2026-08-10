import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buildHookLibrary } from "@/lib/library/hook-library";
import { createClient } from "@/lib/supabase/server";
import { HooksLibrary } from "./hooks-library";

export default async function HooksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: posts }, { data: research }, { data: analyses }, { data: canvas }] = await Promise.all([
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
  ]);

  const items = buildHookLibrary({
    posts: posts ?? [],
    research: research ?? [],
    analyses: analyses ?? [],
    canvas: canvas ?? [],
  });

  return (
    <div>
      <PageHeader
        title="Hook library"
        description="Hooks extracted from your content, saved research, Video Breakdown analyses, and Canvas sources. Performance is shown only when FormCraft has real evidence."
        actions={<Badge variant="primary">{items.length} extracted hooks</Badge>}
      />
      <HooksLibrary items={items} />
    </div>
  );
}
