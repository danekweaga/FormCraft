import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateDefaultBoard } from "./add-from-research";
import { CANVAS_EDGE_LABELS, type CanvasEdgeType, type CanvasNodeType } from "./types";
import { getSystemTemplate, type CanvasTemplateDef } from "./templates";

export async function nextNodePosition(params: {
  supabase: SupabaseClient;
  boardId: string;
}): Promise<{ x: number; y: number }> {
  const { count } = await params.supabase
    .from("canvas_nodes")
    .select("id", { count: "exact", head: true })
    .eq("board_id", params.boardId);
  const index = count ?? 0;
  return {
    x: 40 + (index % 4) * 280,
    y: 40 + Math.floor(index / 4) * 200,
  };
}

export async function insertCanvasNode(params: {
  supabase: SupabaseClient;
  userId: string;
  boardId: string;
  nodeType: CanvasNodeType;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown>;
  position?: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  researchItemId?: string | null;
  ideaGateEvaluationId?: string | null;
  contentPostId?: string | null;
  analysisId?: string | null;
  experimentId?: string | null;
  knowledgeDocumentId?: string | null;
}): Promise<{ id: string }> {
  const pos =
    params.position ??
    (await nextNodePosition({
      supabase: params.supabase,
      boardId: params.boardId,
    }));

  const { data, error } = await params.supabase
    .from("canvas_nodes")
    .insert({
      board_id: params.boardId,
      user_id: params.userId,
      node_type: params.nodeType,
      title: params.title.slice(0, 200),
      body: params.body ?? null,
      payload: params.payload ?? {},
      position_x: pos.x,
      position_y: pos.y,
      width: params.width ?? null,
      height: params.height ?? null,
      research_item_id: params.researchItemId ?? null,
      idea_gate_evaluation_id: params.ideaGateEvaluationId ?? null,
      content_post_id: params.contentPostId ?? null,
      analysis_id: params.analysisId ?? null,
      experiment_id: params.experimentId ?? null,
      knowledge_document_id: params.knowledgeDocumentId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create canvas node");
  }

  await params.supabase
    .from("canvas_boards")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", params.boardId);

  return { id: data.id };
}

export async function insertCanvasEdge(params: {
  supabase: SupabaseClient;
  userId: string;
  boardId: string;
  id?: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: CanvasEdgeType;
}): Promise<{ id: string }> {
  const { data, error } = await params.supabase.from("canvas_edges").upsert(
    {
      ...(params.id ? { id: params.id } : {}),
      board_id: params.boardId,
      user_id: params.userId,
      from_node_id: params.fromNodeId,
      to_node_id: params.toNodeId,
      edge_type: params.edgeType,
      label: CANVAS_EDGE_LABELS[params.edgeType],
    },
    { onConflict: "board_id,from_node_id,to_node_id" },
  ).select("id").single();
  if (error || !data) {
    throw new Error(error?.message ?? "Could not create canvas edge");
  }
  return { id: data.id };
}

export async function addEntityToCanvas(params: {
  supabase: SupabaseClient;
  userId: string;
  boardId?: string;
  nodeType: CanvasNodeType;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown>;
  researchItemId?: string | null;
  ideaGateEvaluationId?: string | null;
  contentPostId?: string | null;
  analysisId?: string | null;
  experimentId?: string | null;
  knowledgeDocumentId?: string | null;
}): Promise<{ boardId: string; nodeId: string }> {
  const boardId =
    params.boardId ??
    (await getOrCreateDefaultBoard({
      supabase: params.supabase,
      userId: params.userId,
    }));

  const node = await insertCanvasNode({
    ...params,
    boardId,
  });

  return { boardId, nodeId: node.id };
}

export async function createBoardFromTemplate(params: {
  supabase: SupabaseClient;
  userId: string;
  template: CanvasTemplateDef;
  title?: string;
}): Promise<string> {
  const { data: board, error } = await params.supabase
    .from("canvas_boards")
    .insert({
      user_id: params.userId,
      title: params.title ?? params.template.name,
      description: params.template.description,
      template_key: params.template.key,
    })
    .select("id")
    .single();
  if (error || !board) {
    throw new Error(error?.message ?? "Could not create board");
  }

  const idByKey = new Map<string, string>();
  for (const node of params.template.nodes) {
    const created = await insertCanvasNode({
      supabase: params.supabase,
      userId: params.userId,
      boardId: board.id,
      nodeType: node.nodeType,
      title: node.title,
      body: node.body ?? null,
      position: { x: node.x, y: node.y },
      width: node.width ?? null,
      height: node.height ?? null,
      payload: { templateKey: params.template.key, seedKey: node.key },
    });
    idByKey.set(node.key, created.id);
  }

  for (const node of params.template.nodes) {
    if (!node.parentKey) continue;
    const nodeId = idByKey.get(node.key);
    const parentId = idByKey.get(node.parentKey);
    if (!nodeId || !parentId) continue;
    await params.supabase
      .from("canvas_nodes")
      .update({ parent_frame_id: parentId })
      .eq("id", nodeId)
      .eq("board_id", board.id)
      .eq("user_id", params.userId);
  }

  for (const edge of params.template.edges) {
    const from = idByKey.get(edge.fromKey);
    const to = idByKey.get(edge.toKey);
    if (!from || !to) continue;
    await insertCanvasEdge({
      supabase: params.supabase,
      userId: params.userId,
      boardId: board.id,
      fromNodeId: from,
      toNodeId: to,
      edgeType: edge.edgeType,
    });
  }

  return board.id;
}

export async function createBoardFromTemplateKey(params: {
  supabase: SupabaseClient;
  userId: string;
  templateKey: string;
  title?: string;
}): Promise<string> {
  const template = getSystemTemplate(params.templateKey);
  if (!template) throw new Error("Unknown template.");
  return createBoardFromTemplate({
    supabase: params.supabase,
    userId: params.userId,
    template,
    title: params.title,
  });
}
