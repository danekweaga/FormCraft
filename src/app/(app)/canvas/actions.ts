"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { analyzeResearchItemAction } from "@/app/(app)/research/actions";
import {
  addEntityToCanvas,
  createBoardFromTemplate,
  createBoardFromTemplateKey,
  insertCanvasEdge,
  insertCanvasNode,
} from "@/lib/canvas/add-entity";
import {
  CANVAS_AI_ACTIONS,
  type CanvasAiAction,
  runCanvasMultiNodeAi,
} from "@/lib/canvas/multi-node-ai";
import {
  SYSTEM_CANVAS_TEMPLATES,
  type CanvasTemplateDef,
} from "@/lib/canvas/templates";
import type { CanvasGraphSnapshot } from "@/lib/canvas/persistence";
import {
  isCanvasEdgeType,
  isCanvasNodeType,
  type CanvasEdgeType,
  type CanvasNodeType,
} from "@/lib/canvas/types";
import { createClient } from "@/lib/supabase/server";

export type CanvasActionState = {
  error?: string;
  success?: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in.", supabase: null, user: null };
  return { supabase, user, error: null };
}

function revalidateBoard(boardId: string) {
  revalidatePath("/canvas");
  revalidatePath(`/canvas/${boardId}`);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function updateCanvasNodePositionAction(formData: FormData) {
  const nodeId = String(formData.get("nodeId") ?? "");
  const x = Number(formData.get("x"));
  const y = Number(formData.get("y"));
  if (!nodeId || !Number.isFinite(x) || !Number.isFinite(y)) return;

  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return;

  await auth.supabase
    .from("canvas_nodes")
    .update({
      position_x: Math.round(x),
      position_y: Math.round(y),
    })
    .eq("id", nodeId)
    .eq("user_id", auth.user.id);

  const { data: node } = await auth.supabase
    .from("canvas_nodes")
    .select("board_id")
    .eq("id", nodeId)
    .maybeSingle();
  if (node?.board_id) {
    await auth.supabase
      .from("canvas_boards")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", node.board_id);
  }
}

export async function updateCanvasNodePositionsBatchAction(input: {
  boardId: string;
  updates: Array<{ id: string; x: number; y: number; width?: number; height?: number }>;
}) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return;
  for (const u of input.updates) {
    await auth.supabase
      .from("canvas_nodes")
      .update({
        position_x: Math.round(u.x),
        position_y: Math.round(u.y),
        ...(u.width != null ? { width: Math.round(u.width) } : {}),
        ...(u.height != null ? { height: Math.round(u.height) } : {}),
      })
      .eq("id", u.id)
      .eq("user_id", auth.user.id)
      .eq("board_id", input.boardId);
  }
  await auth.supabase
    .from("canvas_boards")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.boardId);
}

export async function saveCanvasViewportAction(input: {
  boardId: string;
  viewport: { x: number; y: number; zoom: number };
}) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return;
  await auth.supabase
    .from("canvas_boards")
    .update({ viewport: input.viewport })
    .eq("id", input.boardId)
    .eq("user_id", auth.user.id);
}

export async function createCanvasEdgeAction(input: {
  boardId: string;
  edgeId?: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: string;
}) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return { error: "Not signed in" };
  if (!isCanvasEdgeType(input.edgeType)) return { error: "Invalid edge type" };
  if (input.edgeId && !isUuid(input.edgeId)) return { error: "Invalid edge id" };
  if (input.fromNodeId === input.toNodeId) {
    return { error: "Cannot connect a node to itself" };
  }

  try {
    const edge = await insertCanvasEdge({
      supabase: auth.supabase,
      userId: auth.user.id,
      boardId: input.boardId,
      id: input.edgeId,
      fromNodeId: input.fromNodeId,
      toNodeId: input.toNodeId,
      edgeType: input.edgeType as CanvasEdgeType,
    });
    revalidateBoard(input.boardId);
    return {
      success: true,
      edge: {
        id: edge.id,
        source: input.fromNodeId,
        target: input.toNodeId,
        edgeType: input.edgeType as CanvasEdgeType,
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not create canvas edge.",
    };
  }
}

export async function deleteCanvasNodesAction(input: {
  boardId: string;
  nodeIds: string[];
}) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user || input.nodeIds.length === 0) return;
  await auth.supabase
    .from("canvas_nodes")
    .delete()
    .eq("board_id", input.boardId)
    .eq("user_id", auth.user.id)
    .in("id", input.nodeIds);
  revalidateBoard(input.boardId);
}

export async function deleteCanvasEdgesAction(input: {
  boardId: string;
  edgeIds: string[];
}) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user || input.edgeIds.length === 0) return;
  await auth.supabase
    .from("canvas_edges")
    .delete()
    .eq("board_id", input.boardId)
    .eq("user_id", auth.user.id)
    .in("id", input.edgeIds);
  revalidateBoard(input.boardId);
}

export async function duplicateCanvasNodesAction(input: {
  boardId: string;
  nodeIds: string[];
}) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user || input.nodeIds.length === 0) {
    return { error: "Nothing to duplicate" };
  }

  const { data: selectedNodes } = await auth.supabase
    .from("canvas_nodes")
    .select("*")
    .eq("board_id", input.boardId)
    .eq("user_id", auth.user.id)
    .in("id", input.nodeIds);

  const nodes = [...(selectedNodes ?? [])];
  const selectedIds = new Set(nodes.map((node) => node.id));
  const selectedFrameIds = nodes
    .filter((node) => node.node_type === "frame")
    .map((node) => node.id);
  if (selectedFrameIds.length) {
    const { data: frameChildren } = await auth.supabase
      .from("canvas_nodes")
      .select("*")
      .eq("board_id", input.boardId)
      .eq("user_id", auth.user.id)
      .in("parent_frame_id", selectedFrameIds);
    for (const child of frameChildren ?? []) {
      if (selectedIds.has(child.id)) continue;
      nodes.push(child);
      selectedIds.add(child.id);
    }
  }

  const externalParentIds = Array.from(
    new Set(
      nodes
        .map((node) => node.parent_frame_id as string | null)
        .filter(
          (parentId): parentId is string =>
            typeof parentId === "string" && !selectedIds.has(parentId),
        ),
    ),
  );
  const parentPositions = new Map<string, { x: number; y: number }>();
  if (externalParentIds.length) {
    const { data: parents } = await auth.supabase
      .from("canvas_nodes")
      .select("id, position_x, position_y")
      .eq("board_id", input.boardId)
      .eq("user_id", auth.user.id)
      .in("id", externalParentIds);
    for (const parent of parents ?? []) {
      parentPositions.set(parent.id, {
        x: Number(parent.position_x),
        y: Number(parent.position_y),
      });
    }
  }

  const newIdByOldId = new Map<string, string>();
  for (const node of nodes) {
    const copiedWithParent =
      node.parent_frame_id && selectedIds.has(node.parent_frame_id);
    const externalParentPosition = node.parent_frame_id
      ? parentPositions.get(node.parent_frame_id)
      : null;
    const created = await insertCanvasNode({
      supabase: auth.supabase,
      userId: auth.user.id,
      boardId: input.boardId,
      nodeType: (isCanvasNodeType(node.node_type)
        ? node.node_type
        : "note") as CanvasNodeType,
      title: `${node.title} (copy)`,
      body: node.body,
      payload: (node.payload as Record<string, unknown>) ?? {},
      position: {
        x:
          Number(node.position_x) +
          (copiedWithParent ? 0 : (externalParentPosition?.x ?? 0) + 40),
        y:
          Number(node.position_y) +
          (copiedWithParent ? 0 : (externalParentPosition?.y ?? 0) + 40),
      },
      width: node.width != null ? Number(node.width) : null,
      height: node.height != null ? Number(node.height) : null,
      researchItemId: node.research_item_id,
      ideaGateEvaluationId: node.idea_gate_evaluation_id,
      contentPostId: node.content_post_id,
      analysisId: node.analysis_id,
      experimentId: node.experiment_id,
      knowledgeDocumentId: node.knowledge_document_id,
    });
    newIdByOldId.set(node.id, created.id);
  }

  for (const node of nodes) {
    if (!node.parent_frame_id || !selectedIds.has(node.parent_frame_id)) continue;
    const copiedNodeId = newIdByOldId.get(node.id);
    const copiedParentId = newIdByOldId.get(node.parent_frame_id);
    if (!copiedNodeId || !copiedParentId) continue;
    await auth.supabase
      .from("canvas_nodes")
      .update({ parent_frame_id: copiedParentId })
      .eq("id", copiedNodeId)
      .eq("user_id", auth.user.id);
  }

  const duplicateIds = Array.from(selectedIds);
  const { data: internalEdges } = await auth.supabase
    .from("canvas_edges")
    .select("from_node_id, to_node_id, edge_type")
    .eq("board_id", input.boardId)
    .eq("user_id", auth.user.id)
    .in("from_node_id", duplicateIds)
    .in("to_node_id", duplicateIds);
  for (const edge of internalEdges ?? []) {
    const fromNodeId = newIdByOldId.get(edge.from_node_id);
    const toNodeId = newIdByOldId.get(edge.to_node_id);
    if (!fromNodeId || !toNodeId || !isCanvasEdgeType(edge.edge_type)) continue;
    await insertCanvasEdge({
      supabase: auth.supabase,
      userId: auth.user.id,
      boardId: input.boardId,
      fromNodeId,
      toNodeId,
      edgeType: edge.edge_type,
    });
  }
  revalidateBoard(input.boardId);
  return { success: true, nodeIds: Array.from(newIdByOldId.values()) };
}

export async function groupCanvasNodesAction(input: {
  boardId: string;
  nodeIds: string[];
  title?: string;
}) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user || input.nodeIds.length < 2) {
    return { error: "Select at least two nodes to group." };
  }

  const { data: nodes } = await auth.supabase
    .from("canvas_nodes")
    .select("id, node_type, position_x, position_y, width, height, parent_frame_id")
    .eq("board_id", input.boardId)
    .eq("user_id", auth.user.id)
    .in("id", input.nodeIds);

  if (!nodes || nodes.length !== input.nodeIds.length) {
    return { error: "Some selected nodes were not found." };
  }
  if (nodes.some((node) => node.node_type === "frame" || node.parent_frame_id)) {
    return { error: "Select ungrouped content nodes, not frames or nested nodes." };
  }

  const left = Math.min(...nodes.map((node) => Number(node.position_x)));
  const top = Math.min(...nodes.map((node) => Number(node.position_y)));
  const right = Math.max(
    ...nodes.map((node) => Number(node.position_x) + Number(node.width ?? 240)),
  );
  const bottom = Math.max(
    ...nodes.map((node) => Number(node.position_y) + Number(node.height ?? 150)),
  );
  const padding = 48;
  const frameX = left - padding;
  const frameY = top - padding;

  const frame = await insertCanvasNode({
    supabase: auth.supabase,
    userId: auth.user.id,
    boardId: input.boardId,
    nodeType: "frame",
    title: input.title?.trim().slice(0, 120) || "Grouped workflow",
    body: `${nodes.length} connected canvas items`,
    position: { x: frameX, y: frameY },
    width: Math.max(360, right - left + padding * 2),
    height: Math.max(260, bottom - top + padding * 2),
    payload: { groupedNodeIds: input.nodeIds },
  });

  for (const node of nodes) {
    await auth.supabase
      .from("canvas_nodes")
      .update({
        parent_frame_id: frame.id,
        position_x: Number(node.position_x) - frameX,
        position_y: Number(node.position_y) - frameY,
      })
      .eq("id", node.id)
      .eq("board_id", input.boardId)
      .eq("user_id", auth.user.id);
  }

  revalidateBoard(input.boardId);
  return { success: true, frameId: frame.id };
}

export async function ungroupCanvasFrameAction(input: {
  boardId: string;
  frameId: string;
}) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return { error: "Not signed in" };

  const { data: frame } = await auth.supabase
    .from("canvas_nodes")
    .select("id, node_type, position_x, position_y")
    .eq("id", input.frameId)
    .eq("board_id", input.boardId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!frame || frame.node_type !== "frame") return { error: "Frame not found." };

  const { data: children } = await auth.supabase
    .from("canvas_nodes")
    .select("id, position_x, position_y")
    .eq("parent_frame_id", frame.id)
    .eq("board_id", input.boardId)
    .eq("user_id", auth.user.id);

  for (const child of children ?? []) {
    await auth.supabase
      .from("canvas_nodes")
      .update({
        parent_frame_id: null,
        position_x: Number(frame.position_x) + Number(child.position_x),
        position_y: Number(frame.position_y) + Number(child.position_y),
      })
      .eq("id", child.id)
      .eq("user_id", auth.user.id);
  }

  await auth.supabase
    .from("canvas_nodes")
    .delete()
    .eq("id", frame.id)
    .eq("user_id", auth.user.id);
  revalidateBoard(input.boardId);
  return { success: true };
}

export async function persistCanvasGraphAction(input: {
  boardId: string;
  snapshot: CanvasGraphSnapshot;
}) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return { error: "Not signed in" };
  if (input.snapshot.nodes.length > 500 || input.snapshot.edges.length > 1000) {
    return { error: "Canvas snapshot is too large." };
  }
  if (
    input.snapshot.nodes.some(
      (node) => !isUuid(node.id) || !isCanvasNodeType(node.nodeType),
    ) ||
    input.snapshot.edges.some(
      (edge) =>
        !isUuid(edge.id) ||
        !isCanvasEdgeType(edge.edgeType) ||
        !isUuid(edge.source) ||
        !isUuid(edge.target),
    )
  ) {
    return { error: "Canvas snapshot contains invalid identifiers." };
  }

  const { data: board } = await auth.supabase
    .from("canvas_boards")
    .select("id")
    .eq("id", input.boardId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!board) return { error: "Board not found." };

  const nodeIds = new Set(input.snapshot.nodes.map((node) => node.id));
  const frameIds = new Set(
    input.snapshot.nodes
      .filter((node) => node.nodeType === "frame")
      .map((node) => node.id),
  );
  if (
    input.snapshot.nodes.some(
      (node) => node.parentFrameId && !frameIds.has(node.parentFrameId),
    ) ||
    input.snapshot.edges.some(
      (edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target),
    )
  ) {
    return { error: "Canvas snapshot has broken lineage references." };
  }

  const [{ data: currentNodes }, { data: currentEdges }] = await Promise.all([
    auth.supabase
      .from("canvas_nodes")
      .select("id")
      .eq("board_id", input.boardId)
      .eq("user_id", auth.user.id),
    auth.supabase
      .from("canvas_edges")
      .select("id")
      .eq("board_id", input.boardId)
      .eq("user_id", auth.user.id),
  ]);

  const nextEdgeIds = new Set(input.snapshot.edges.map((edge) => edge.id));
  const removedEdgeIds = (currentEdges ?? [])
    .map((edge) => edge.id)
    .filter((id) => !nextEdgeIds.has(id));
  if (removedEdgeIds.length) {
    await auth.supabase
      .from("canvas_edges")
      .delete()
      .eq("board_id", input.boardId)
      .eq("user_id", auth.user.id)
      .in("id", removedEdgeIds);
  }

  if (input.snapshot.nodes.length) {
    const nodeRows = input.snapshot.nodes.map((node) => ({
      id: node.id,
      board_id: input.boardId,
      user_id: auth.user!.id,
      node_type: node.nodeType,
      title: node.title.slice(0, 200),
      body: node.body,
      payload: node.payload,
      position_x: Math.round(node.position.x),
      position_y: Math.round(node.position.y),
      width: node.width,
      height: node.height,
      parent_frame_id: null,
      research_item_id: node.researchItemId,
      idea_gate_evaluation_id: node.ideaGateEvaluationId,
      content_post_id: node.contentPostId,
      analysis_id: node.analysisId,
      experiment_id: node.experimentId,
      knowledge_document_id: node.knowledgeDocumentId,
    }));
    await auth.supabase.from("canvas_nodes").upsert(nodeRows, { onConflict: "id" });

    for (const node of input.snapshot.nodes) {
      if (!node.parentFrameId) continue;
      await auth.supabase
        .from("canvas_nodes")
        .update({ parent_frame_id: node.parentFrameId })
        .eq("id", node.id)
        .eq("board_id", input.boardId)
        .eq("user_id", auth.user.id);
    }
  }

  if (input.snapshot.edges.length) {
    for (const edge of input.snapshot.edges) {
      try {
        await insertCanvasEdge({
          supabase: auth.supabase,
          userId: auth.user.id,
          boardId: input.boardId,
          id: edge.id,
          fromNodeId: edge.source,
          toNodeId: edge.target,
          edgeType: edge.edgeType,
        });
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Could not persist canvas edges.",
        };
      }
    }
  }

  const removedNodeIds = (currentNodes ?? [])
    .map((node) => node.id)
    .filter((id) => !nodeIds.has(id));
  if (removedNodeIds.length) {
    await auth.supabase
      .from("canvas_nodes")
      .delete()
      .eq("board_id", input.boardId)
      .eq("user_id", auth.user.id)
      .in("id", removedNodeIds);
  }

  await auth.supabase
    .from("canvas_boards")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.boardId)
    .eq("user_id", auth.user.id);
  revalidateBoard(input.boardId);
  return { success: true };
}

export async function createCaptureNodeAction(formData: FormData) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return { error: "Not signed in" };

  const kind = String(formData.get("kind") ?? "note");
  const text = String(formData.get("text") ?? "").trim();
  const boardIdRaw = String(formData.get("boardId") ?? "");
  const audioValue = formData.get("audio");
  const audioFile = audioValue instanceof File && audioValue.size > 0
    ? audioValue
    : null;
  if (text.length < 1 && !audioFile) {
    return { error: "Enter something to capture or record a voice note." };
  }
  if (audioFile && kind !== "voice_note") {
    return { error: "Audio can only be attached to a voice note." };
  }
  const allowedAudioTypes = new Set([
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
    "audio/mpeg",
  ]);
  const normalizedAudioType = audioFile?.type.split(";")[0] ?? "";
  if (audioFile && !allowedAudioTypes.has(normalizedAudioType)) {
    return { error: "Unsupported voice-note audio format." };
  }
  if (audioFile && audioFile.size > 900_000) {
    return { error: "Voice note is too large. Keep it under 60 seconds." };
  }

  let nodeType: CanvasNodeType = "note";
  if (kind === "idea") nodeType = "idea";
  if (kind === "url" || kind === "website") nodeType = "website";
  if (kind === "voice_note") nodeType = "voice_note";
  if (kind === "research") nodeType = "external_outlier";

  const result = await addEntityToCanvas({
    supabase: auth.supabase,
    userId: auth.user.id,
    boardId: boardIdRaw || undefined,
    nodeType,
    title: text.slice(0, 80) || "Voice note",
    body: text || null,
    payload: { captureKind: kind },
  });

  if (audioFile) {
    const extensionByType: Record<string, string> = {
      "audio/webm": "webm",
      "audio/mp4": "m4a",
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
    };
    const audioPath = `${auth.user.id}/${result.nodeId}/voice-note.${extensionByType[normalizedAudioType] ?? "webm"}`;
    const bytes = Buffer.from(await audioFile.arrayBuffer());
    const { error: uploadError } = await auth.supabase.storage
      .from("canvas-media")
      .upload(audioPath, bytes, {
        contentType: normalizedAudioType,
        upsert: true,
      });
    if (uploadError) {
      await auth.supabase
        .from("canvas_nodes")
        .delete()
        .eq("id", result.nodeId)
        .eq("user_id", auth.user.id);
      return { error: `Could not save voice note: ${uploadError.message}` };
    }
    const { error: updateError } = await auth.supabase
      .from("canvas_nodes")
      .update({
        payload: {
          captureKind: kind,
          audioPath,
          audioMimeType: normalizedAudioType,
          audioSizeBytes: audioFile.size,
        },
      })
      .eq("id", result.nodeId)
      .eq("user_id", auth.user.id);
    if (updateError) {
      await auth.supabase.storage.from("canvas-media").remove([audioPath]);
      await auth.supabase
        .from("canvas_nodes")
        .delete()
        .eq("id", result.nodeId)
        .eq("user_id", auth.user.id);
      return { error: `Could not attach voice note: ${updateError.message}` };
    }
  }

  revalidateBoard(result.boardId);
  return { success: true, boardId: result.boardId, nodeId: result.nodeId };
}

export async function createBoardFromTemplateAction(formData: FormData) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return;
  const templateKey = String(formData.get("templateKey") ?? "");
  const title = String(formData.get("title") ?? "").trim() || undefined;
  if (!SYSTEM_CANVAS_TEMPLATES.some((t) => t.key === templateKey)) {
    return;
  }
  const boardId = await createBoardFromTemplateKey({
    supabase: auth.supabase,
    userId: auth.user.id,
    templateKey,
    title,
  });
  redirect(`/canvas/${boardId}`);
}

export async function saveBoardAsTemplateAction(formData: FormData) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return;
  const boardId = String(formData.get("boardId") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!isUuid(boardId) || name.length < 2) {
    return;
  }

  const [{ data: board }, { data: nodes }, { data: edges }] = await Promise.all([
    auth.supabase
      .from("canvas_boards")
      .select("id, description")
      .eq("id", boardId)
      .eq("user_id", auth.user.id)
      .maybeSingle(),
    auth.supabase
      .from("canvas_nodes")
      .select(
        "id, node_type, title, body, position_x, position_y, width, height, parent_frame_id",
      )
      .eq("board_id", boardId)
      .eq("user_id", auth.user.id),
    auth.supabase
      .from("canvas_edges")
      .select("from_node_id, to_node_id, edge_type")
      .eq("board_id", boardId)
      .eq("user_id", auth.user.id),
  ]);
  if (!board) return;

  const templateNodes = (nodes ?? []).flatMap((node) => {
    if (!isCanvasNodeType(node.node_type)) return [];
    return [
      {
        key: node.id,
        ...(node.parent_frame_id ? { parentKey: node.parent_frame_id } : {}),
        nodeType: node.node_type,
        title: node.title,
        ...(node.body ? { body: node.body } : {}),
        x: Number(node.position_x),
        y: Number(node.position_y),
        ...(node.width != null ? { width: Number(node.width) } : {}),
        ...(node.height != null ? { height: Number(node.height) } : {}),
      },
    ];
  });
  const templateEdges = (edges ?? []).flatMap((edge) => {
    if (!isCanvasEdgeType(edge.edge_type)) return [];
    return [
      {
        fromKey: edge.from_node_id,
        toKey: edge.to_node_id,
        edgeType: edge.edge_type,
      },
    ];
  });

  const key = `user_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await auth.supabase.from("canvas_templates").insert({
    user_id: auth.user.id,
    key,
    name,
    description: board.description || `Saved from ${name}`,
    is_system: false,
    nodes: templateNodes,
    edges: templateEdges,
  });
  if (error) return;
  revalidatePath("/canvas");
}

export async function createBoardFromSavedTemplateAction(formData: FormData) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return;
  const templateId = String(formData.get("templateId") ?? "");
  if (!isUuid(templateId)) return;

  const { data: stored } = await auth.supabase
    .from("canvas_templates")
    .select("key, name, description, nodes, edges")
    .eq("id", templateId)
    .eq("user_id", auth.user.id)
    .eq("is_system", false)
    .maybeSingle();
  if (!stored) return;

  const rawNodes = Array.isArray(stored.nodes) ? stored.nodes : [];
  const rawEdges = Array.isArray(stored.edges) ? stored.edges : [];
  const nodes: CanvasTemplateDef["nodes"] = rawNodes.flatMap((value) => {
    const node = value as Record<string, unknown>;
    const nodeType = String(node.nodeType ?? "");
    const x = Number(node.x);
    const y = Number(node.y);
    if (
      !isCanvasNodeType(nodeType) ||
      !String(node.key ?? "") ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return [];
    }
    return [
      {
        key: String(node.key),
        ...(node.parentKey ? { parentKey: String(node.parentKey) } : {}),
        nodeType,
        title: String(node.title ?? "Untitled").slice(0, 200),
        ...(node.body ? { body: String(node.body) } : {}),
        x,
        y,
        ...(Number.isFinite(Number(node.width))
          ? { width: Number(node.width) }
          : {}),
        ...(Number.isFinite(Number(node.height))
          ? { height: Number(node.height) }
          : {}),
      },
    ];
  });
  const edges: CanvasTemplateDef["edges"] = rawEdges.flatMap((value) => {
    const edge = value as Record<string, unknown>;
    const edgeType = String(edge.edgeType ?? "");
    if (
      !isCanvasEdgeType(edgeType) ||
      !String(edge.fromKey ?? "") ||
      !String(edge.toKey ?? "")
    ) {
      return [];
    }
    return [
      {
        fromKey: String(edge.fromKey),
        toKey: String(edge.toKey),
        edgeType,
      },
    ];
  });
  if (!nodes.length) return;

  const boardId = await createBoardFromTemplate({
    supabase: auth.supabase,
    userId: auth.user.id,
    template: {
      key: stored.key,
      name: stored.name,
      description: stored.description ?? "Personal Canvas template",
      nodes,
      edges,
    },
  });
  redirect(`/canvas/${boardId}`);
}

export async function deleteSavedTemplateAction(formData: FormData) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return;
  const templateId = String(formData.get("templateId") ?? "");
  if (!isUuid(templateId)) return;
  await auth.supabase
    .from("canvas_templates")
    .delete()
    .eq("id", templateId)
    .eq("user_id", auth.user.id)
    .eq("is_system", false);
  revalidatePath("/canvas");
}

export async function createBlankBoardAction(formData: FormData) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return;
  const title = String(formData.get("title") ?? "").trim() || "Untitled board";
  const { data, error } = await auth.supabase
    .from("canvas_boards")
    .insert({ user_id: auth.user.id, title })
    .select("id")
    .single();
  if (error || !data) return;
  redirect(`/canvas/${data.id}`);
}

export async function renameBoardAction(formData: FormData) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return;
  const boardId = String(formData.get("boardId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!boardId || title.length < 1) return;
  await auth.supabase
    .from("canvas_boards")
    .update({ title: title.slice(0, 120) })
    .eq("id", boardId)
    .eq("user_id", auth.user.id);
  revalidateBoard(boardId);
}

export async function deleteBoardAction(formData: FormData) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return;
  const boardId = String(formData.get("boardId") ?? "");
  if (!boardId) return;

  const { data: owned } = await auth.supabase
    .from("canvas_boards")
    .select("id")
    .eq("id", boardId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!owned) return;

  await auth.supabase.from("canvas_edges").delete().eq("board_id", boardId);
  const { data: nodes } = await auth.supabase
    .from("canvas_nodes")
    .select("id")
    .eq("board_id", boardId);
  const nodeIds = (nodes ?? []).map((node) => node.id);
  if (nodeIds.length > 0) {
    await auth.supabase.from("canvas_nodes").delete().in("id", nodeIds);
  }
  await auth.supabase
    .from("canvas_boards")
    .delete()
    .eq("id", boardId)
    .eq("user_id", auth.user.id);
  revalidatePath("/canvas");
  redirect("/canvas");
}

export async function addEntityToCanvasAction(formData: FormData) {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return { error: "Not signed in" };

  const nodeTypeRaw = String(formData.get("nodeType") ?? "note");
  const title = String(formData.get("title") ?? "").trim() || "Untitled";
  const body = String(formData.get("body") ?? "").trim() || null;
  const entityId = String(formData.get("entityId") ?? "") || null;
  if (!isCanvasNodeType(nodeTypeRaw)) return { error: "Invalid node type" };

  const result = await addEntityToCanvas({
    supabase: auth.supabase,
    userId: auth.user.id,
    nodeType: nodeTypeRaw,
    title,
    body,
    contentPostId: nodeTypeRaw === "my_content" ? entityId : null,
    analysisId: nodeTypeRaw === "analysis" ? entityId : null,
    experimentId: nodeTypeRaw === "experiment" ? entityId : null,
    knowledgeDocumentId: nodeTypeRaw === "knowledge" ? entityId : null,
    ideaGateEvaluationId: nodeTypeRaw === "idea" ? entityId : null,
    researchItemId:
      nodeTypeRaw === "external_outlier" || nodeTypeRaw === "source"
        ? entityId
        : null,
    payload: { entityId },
  });

  revalidateBoard(result.boardId);
  return { success: true, boardId: result.boardId };
}

export async function runCanvasAiAction(input: {
  boardId: string;
  action: string;
  nodeIds: string[];
}): Promise<CanvasActionState & { nodeId?: string }> {
  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return { error: "Not signed in" };
  if (!CANVAS_AI_ACTIONS.includes(input.action as CanvasAiAction)) {
    return { error: "Unknown AI action" };
  }
  if (input.nodeIds.length < 1) return { error: "Select at least one node." };

  const { data: nodes } = await auth.supabase
    .from("canvas_nodes")
    .select("id, node_type, title, body, position_x, position_y")
    .eq("board_id", input.boardId)
    .eq("user_id", auth.user.id)
    .in("id", input.nodeIds);

  if (!nodes?.length) return { error: "Nodes not found." };

  const { result, usedLlm, modelName, fallbackReason } =
    await runCanvasMultiNodeAi({
      supabase: auth.supabase,
      userId: auth.user.id,
      action: input.action as CanvasAiAction,
      nodes: nodes.map((n) => ({
        id: n.id,
        nodeType: n.node_type,
        title: n.title,
        body: n.body,
      })),
    });

  const maxX = Math.max(...nodes.map((n) => Number(n.position_x)));
  const avgY =
    nodes.reduce((s, n) => s + Number(n.position_y), 0) / nodes.length;

  const title = usedLlm
    ? result.title.slice(0, 120)
    : `[Heuristic] ${result.title}`.slice(0, 120);
  const bodyParts = [
    !usedLlm
      ? `Heuristic — AI unavailable${fallbackReason ? `: ${fallbackReason}` : ""}.`
      : null,
    result.summary,
    ...result.bullets.map((b) => `• ${b}`),
  ].filter(Boolean);

  const created = await insertCanvasNode({
    supabase: auth.supabase,
    userId: auth.user.id,
    boardId: input.boardId,
    nodeType: result.suggestedNodeType,
    title,
    body: bodyParts.join("\n"),
    position: { x: maxX + 300, y: avgY },
    payload: {
      canvasAiAction: input.action,
      usedLlm,
      modelName,
      sourceNodeIds: input.nodeIds,
      heuristic: !usedLlm,
      fallbackReason: fallbackReason ?? null,
    },
  });

  for (const n of nodes) {
    await insertCanvasEdge({
      supabase: auth.supabase,
      userId: auth.user.id,
      boardId: input.boardId,
      fromNodeId: n.id,
      toNodeId: created.id,
      edgeType: "resulted_in",
    });
  }

  revalidateBoard(input.boardId);
  return {
    success: usedLlm
      ? `AI result added with ${modelName}.`
      : `Added heuristic result (AI unavailable${fallbackReason ? `: ${fallbackReason}` : ""}).`,
    nodeId: created.id,
  };
}

export async function analyzeCanvasSourceNodeAction(
  formData: FormData,
): Promise<void> {
  const nodeId = String(formData.get("nodeId") ?? "");
  const researchItemId = String(formData.get("researchItemId") ?? "");
  if (!nodeId || !researchItemId) return;

  const auth = await requireUser();
  if (!auth.supabase || !auth.user) return;

  const { data: node } = await auth.supabase
    .from("canvas_nodes")
    .select("id, board_id, position_x, position_y, research_item_id, node_type")
    .eq("id", nodeId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (
    !node ||
    !["source", "external_outlier", "source_post"].includes(node.node_type)
  ) {
    return;
  }
  if (node.research_item_id !== researchItemId) return;

  const analyzeFd = new FormData();
  analyzeFd.set("id", researchItemId);
  const result = await analyzeResearchItemAction(analyzeFd);
  if (result.error) return;

  const { ensureCanvasAnalysisNodes } = await import(
    "@/lib/canvas/add-from-research"
  );
  await ensureCanvasAnalysisNodes({
    supabase: auth.supabase,
    userId: auth.user.id,
    boardId: node.board_id,
    sourceNodeId: node.id,
    researchItemId,
    baseX: Number(node.position_x) || 40,
    baseY: Number(node.position_y) || 40,
  });

  revalidateBoard(node.board_id);
  revalidatePath("/research");
}
