import type { Edge, Node } from "@xyflow/react";
import {
  CANVAS_EDGE_LABELS,
  CANVAS_NODE_LABELS,
  normalizeEdgeType,
  normalizeNodeType,
  type CanvasEdgeType,
  type CanvasNodeType,
} from "./types";

export type CanvasNodeData = {
  nodeType: CanvasNodeType;
  title: string;
  body: string | null;
  payload?: Record<string, unknown>;
  researchItemId: string | null;
  ideaGateEvaluationId: string | null;
  contentPostId?: string | null;
  analysisId?: string | null;
  experimentId?: string | null;
  knowledgeDocumentId?: string | null;
  parentFrameId?: string | null;
  hasAnalysis?: boolean;
  [key: string]: unknown;
};

export type DbCanvasNode = {
  id: string;
  node_type: string;
  title: string;
  body: string | null;
  position_x: number;
  position_y: number;
  width?: number | null;
  height?: number | null;
  payload?: Record<string, unknown> | null;
  research_item_id: string | null;
  idea_gate_evaluation_id: string | null;
  content_post_id?: string | null;
  analysis_id?: string | null;
  experiment_id?: string | null;
  knowledge_document_id?: string | null;
  parent_frame_id?: string | null;
  has_analysis?: boolean;
};

export type DbCanvasEdge = {
  id: string;
  from_node_id: string;
  to_node_id: string;
  label: string | null;
  edge_type?: string | null;
};

export type CanvasSnapshotNode = {
  id: string;
  nodeType: CanvasNodeType;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  position: { x: number; y: number };
  width: number | null;
  height: number | null;
  parentFrameId: string | null;
  researchItemId: string | null;
  ideaGateEvaluationId: string | null;
  contentPostId: string | null;
  analysisId: string | null;
  experimentId: string | null;
  knowledgeDocumentId: string | null;
};

export type CanvasSnapshotEdge = {
  id: string;
  source: string;
  target: string;
  edgeType: CanvasEdgeType;
};

export type CanvasGraphSnapshot = {
  nodes: CanvasSnapshotNode[];
  edges: CanvasSnapshotEdge[];
};

export function dbNodesToFlow(nodes: DbCanvasNode[]): Node<CanvasNodeData>[] {
  const ordered = [...nodes].sort((a, b) => {
    if (a.node_type === "frame" && b.node_type !== "frame") return -1;
    if (a.node_type !== "frame" && b.node_type === "frame") return 1;
    return 0;
  });

  return ordered.map((n) => {
    const nodeType = normalizeNodeType(n.node_type);
    const parentFrameId = n.parent_frame_id ?? null;
    return {
      id: n.id,
      type: nodeType === "frame" ? "frame" : "formcraft",
      position: { x: Number(n.position_x), y: Number(n.position_y) },
      parentId: parentFrameId ?? undefined,
      extent: parentFrameId ? "parent" : undefined,
      expandParent: Boolean(parentFrameId),
      zIndex: nodeType === "frame" ? -1 : 0,
      style:
        n.width || n.height
          ? {
              width: n.width ? Number(n.width) : undefined,
              height: n.height ? Number(n.height) : undefined,
            }
          : undefined,
      data: {
        nodeType,
        title: n.title || CANVAS_NODE_LABELS[nodeType],
        body: n.body,
        payload: n.payload ?? {},
        researchItemId: n.research_item_id,
        ideaGateEvaluationId: n.idea_gate_evaluation_id,
        contentPostId: n.content_post_id ?? null,
        analysisId: n.analysis_id ?? null,
        experimentId: n.experiment_id ?? null,
        knowledgeDocumentId: n.knowledge_document_id ?? null,
        parentFrameId,
        hasAnalysis: n.has_analysis,
      },
    };
  });
}

export function dbEdgesToFlow(edges: DbCanvasEdge[]): Edge[] {
  return edges.map((e) => {
    const edgeType = normalizeEdgeType(e.edge_type ?? e.label);
    return {
      id: e.id,
      source: e.from_node_id,
      target: e.to_node_id,
      label: e.label || CANVAS_EDGE_LABELS[edgeType],
      data: { edgeType },
    };
  });
}

export function flowPositionToDb(position: { x: number; y: number }) {
  return {
    position_x: Math.round(position.x),
    position_y: Math.round(position.y),
  };
}

export function edgeTypeLabel(edgeType: CanvasEdgeType): string {
  return CANVAS_EDGE_LABELS[edgeType];
}
