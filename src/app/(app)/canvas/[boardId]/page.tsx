import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { dbEdgesToFlow, dbNodesToFlow } from "@/lib/canvas/persistence";
import { createClient } from "@/lib/supabase/server";
import { CanvasBoard } from "../canvas-board";
import { renameBoardAction, saveBoardAsTemplateAction } from "../actions";

export default async function CanvasBoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: board, error: boardError }, { data: nodes, error: nodesError }, { data: edges, error: edgesError }] =
    await Promise.all([
    supabase
      .from("canvas_boards")
      .select("id, title, description, template_key, viewport, updated_at")
      .eq("id", boardId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("canvas_nodes")
      .select(
        "id, node_type, title, body, payload, position_x, position_y, width, height, parent_frame_id, research_item_id, idea_gate_evaluation_id, content_post_id, analysis_id, experiment_id, knowledge_document_id",
      )
      .eq("board_id", boardId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("canvas_edges")
      .select("id, from_node_id, to_node_id, label, edge_type")
      .eq("board_id", boardId)
      .eq("user_id", user.id),
  ]);

  if (boardError) {
    throw new Error(`Canvas board query failed: ${boardError.message}`);
  }
  if (!board) notFound();
  if (nodesError) {
    throw new Error(`Canvas nodes query failed: ${nodesError.message}`);
  }
  if (edgesError) {
    throw new Error(`Canvas edges query failed: ${edgesError.message}`);
  }

  const nodesWithSignedAudio = await Promise.all(
    (nodes ?? []).map(async (node) => {
      const payload =
        node.payload && typeof node.payload === "object"
          ? (node.payload as Record<string, unknown>)
          : {};
      const audioPath =
        typeof payload.audioPath === "string" ? payload.audioPath : null;
      if (!audioPath) return node;
      const { data } = await supabase.storage
        .from("canvas-media")
        .createSignedUrl(audioPath, 3600);
      return {
        ...node,
        payload: { ...payload, audioUrl: data?.signedUrl ?? null },
      };
    }),
  );

  const researchIds = Array.from(
    new Set(
      nodesWithSignedAudio
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

  const flowNodes = dbNodesToFlow(
    nodesWithSignedAudio.map((n) => ({
      ...n,
      position_x: Number(n.position_x),
      position_y: Number(n.position_y),
      width: n.width != null ? Number(n.width) : null,
      height: n.height != null ? Number(n.height) : null,
      has_analysis: n.research_item_id
        ? analyzedIds.has(n.research_item_id)
        : false,
    })),
  );
  const flowEdges = dbEdgesToFlow(edges ?? []);

  const viewport =
    board.viewport &&
    typeof board.viewport === "object" &&
    "zoom" in (board.viewport as object)
      ? (board.viewport as { x: number; y: number; zoom: number })
      : undefined;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/canvas">← All boards</Link>
      </Button>
      <PageHeader
        title={board.title}
        description={
          board.description ||
          "Pan, zoom, connect, Ctrl/Cmd-click to multi-select, Delete to remove, ⌘/Ctrl+K to capture."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/research?mode=outliers">Research</Link>
            </Button>
            <form action={renameBoardAction} className="flex gap-2">
              <input type="hidden" name="boardId" value={board.id} />
              <input
                name="title"
                defaultValue={board.title}
                className="h-9 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2 text-sm"
              />
              <Button type="submit" size="sm" variant="outline">
                Rename
              </Button>
            </form>
            <form action={saveBoardAsTemplateAction} className="flex gap-2">
              <input type="hidden" name="boardId" value={board.id} />
              <input
                name="name"
                defaultValue={`${board.title} template`}
                aria-label="Template name"
                className="h-9 max-w-48 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2 text-sm"
              />
              <Button type="submit" size="sm" variant="outline">
                Save as template
              </Button>
            </form>
          </div>
        }
      />

      {flowNodes.length === 0 ? (
        <EmptyState
          title="Empty board"
          description="Add from Research / Analyze / My Content, use Capture (⌘/Ctrl+K), or start from a template on the Canvas home."
          action={
            <Button asChild>
              <Link href="/research?mode=outliers">Browse outliers</Link>
            </Button>
          }
        />
      ) : null}

      <CanvasBoard
        boardId={board.id}
        initialNodes={flowNodes}
        initialEdges={flowEdges}
        initialViewport={viewport}
      />
    </div>
  );
}
