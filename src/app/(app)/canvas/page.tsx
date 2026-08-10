import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateDefaultBoard } from "@/lib/canvas/add-from-research";
import { CanvasBoard } from "./canvas-board";

export default async function CanvasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const boardId = await getOrCreateDefaultBoard({
    supabase,
    userId: user.id,
  });

  const [{ data: board }, { data: nodes }, { data: edges }] = await Promise.all([
    supabase
      .from("canvas_boards")
      .select("id, title, updated_at")
      .eq("id", boardId)
      .maybeSingle(),
    supabase
      .from("canvas_nodes")
      .select(
        "id, node_type, title, body, position_x, position_y, research_item_id, idea_gate_evaluation_id",
      )
      .eq("board_id", boardId)
      .order("created_at", { ascending: true }),
    supabase
      .from("canvas_edges")
      .select("id, from_node_id, to_node_id, label")
      .eq("board_id", boardId),
  ]);

  const researchIds = Array.from(
    new Set(
      (nodes ?? [])
        .map((n) => n.research_item_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const analyzedIds = new Set<string>();
  if (researchIds.length > 0) {
    const { data: items } = await supabase
      .from("research_items")
      .select("id, analysis, analysis_model")
      .eq("user_id", user.id)
      .in("id", researchIds);
    for (const item of items ?? []) {
      const analysis = (item.analysis ?? {}) as Record<string, unknown>;
      const has =
        Boolean(item.analysis_model) ||
        Boolean(analysis.hookType) ||
        Boolean(analysis.reusablePattern) ||
        (Array.isArray(analysis.whyItMayWork) &&
          analysis.whyItMayWork.length > 0);
      if (has) analyzedIds.add(item.id);
    }
  }

  const boardNodes = (nodes ?? []).map((n) => ({
    id: n.id,
    node_type: n.node_type,
    title: n.title ?? "Untitled",
    body: n.body,
    position_x: Number(n.position_x),
    position_y: Number(n.position_y),
    research_item_id: n.research_item_id,
    idea_gate_evaluation_id: n.idea_gate_evaluation_id,
    has_analysis: n.research_item_id
      ? analyzedIds.has(n.research_item_id)
      : false,
  }));

  return (
    <div>
      <PageHeader
        title="Research Canvas"
        description="Map outliers → analysis → patterns → ideas. Drag nodes; analyze sources on the board."
        actions={
          <Button asChild variant="outline">
            <Link href="/research?mode=outliers">Open Research</Link>
          </Button>
        }
      />

      <p className="mb-4 text-sm text-secondary">
        Board: {board?.title ?? "Research board"}
        {board?.updated_at
          ? ` · updated ${new Date(board.updated_at).toLocaleString()}`
          : ""}
      </p>

      {(nodes?.length ?? 0) === 0 ? (
        <EmptyState
          title="Canvas is empty"
          description="Open an outlier in Research and click Add to Canvas. Analyzed posts also add analysis and pattern nodes."
          action={
            <Button asChild>
              <Link href="/research?mode=outliers">Browse outliers</Link>
            </Button>
          }
        />
      ) : (
        <CanvasBoard
          initialNodes={boardNodes}
          initialEdges={(edges ?? []).map((e) => ({
            id: e.id,
            from_node_id: e.from_node_id,
            to_node_id: e.to_node_id,
            label: e.label,
          }))}
        />
      )}
    </div>
  );
}
