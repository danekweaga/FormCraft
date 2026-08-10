"use client";

import { memo } from "react";
import Link from "next/link";
import {
  Handle,
  NodeResizer,
  Position,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CANVAS_NODE_LABELS,
  type CanvasNodeType,
} from "@/lib/canvas/types";
import type { CanvasNodeData } from "@/lib/canvas/persistence";
import { analyzeCanvasSourceNodeAction } from "@/app/(app)/canvas/actions";

const TYPE_STYLES: Record<string, string> = {
  external_outlier: "border-primary-container/50 bg-primary-container/10",
  source: "border-primary-container/50 bg-primary-container/10",
  source_post: "border-primary-container/50 bg-primary-container/10",
  analysis: "border-tertiary/40 bg-tertiary/5",
  pattern: "border-outline-variant/50 bg-surface-container-low",
  idea: "border-primary/40 bg-primary/5",
  script: "border-primary/30 bg-surface-primary",
  draft: "border-outline-variant/40 bg-surface-primary",
  experiment: "border-tertiary/50 bg-tertiary/10",
  my_content: "border-primary/40 bg-primary/5",
  knowledge: "border-outline-variant/40 bg-surface-container-lowest",
  ai_node: "border-primary-container/60 bg-primary-container/15",
  note: "border-outline-variant/30 bg-surface-container-lowest",
  frame: "border-dashed border-outline-variant/40 bg-transparent",
  audience_insight: "border-tertiary/30 bg-tertiary/5",
  performance_lesson: "border-primary/30 bg-primary/5",
  roadmap_milestone: "border-outline-variant/40 bg-surface-alt/40",
};

function linkFor(data: CanvasNodeData): string | null {
  if (data.analysisId) return `/analyze/${data.analysisId}`;
  if (data.contentPostId) return `/my-content/${data.contentPostId}`;
  if (data.researchItemId) return `/research?mode=saved`;
  if (data.ideaGateEvaluationId) return `/idea-gate`;
  if (data.experimentId) return `/experiments`;
  return null;
}

function FormCraftNodeComponent({
  id,
  data,
  selected,
}: NodeProps<Node<CanvasNodeData>>) {
  const nodeType = data.nodeType as CanvasNodeType;
  const href = linkFor(data);
  const style = TYPE_STYLES[nodeType] ?? TYPE_STYLES.note;
  const audioUrl =
    typeof data.payload?.audioUrl === "string" ? data.payload.audioUrl : null;

  return (
    <div
      className={`h-full w-full min-w-[200px] rounded-xl border p-3 paper-shadow ${style} ${
        selected ? "ring-2 ring-primary/40" : ""
      }`}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        lineClassName="!border-primary/50"
        handleClassName="!h-2.5 !w-2.5 !border-primary !bg-surface-primary"
      />
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <div className="flex flex-wrap gap-1">
        <Badge variant="default">{CANVAS_NODE_LABELS[nodeType] ?? nodeType}</Badge>
        {data.hasAnalysis ? <Badge variant="success">Analyzed</Badge> : null}
      </div>
      <p className="mt-2 text-sm font-semibold text-on-background line-clamp-2">
        {data.title}
      </p>
      {data.body ? (
        <p className="mt-1 line-clamp-3 text-xs text-secondary">{data.body}</p>
      ) : null}
      {audioUrl ? (
        <audio controls preload="none" src={audioUrl} className="mt-2 h-8 w-full">
          Your browser does not support audio playback.
        </audio>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        {href ? (
          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[10px]">
            <Link href={href}>Open</Link>
          </Button>
        ) : null}
        {data.researchItemId &&
        ["source", "external_outlier", "source_post"].includes(nodeType) &&
        !data.hasAnalysis ? (
          <form action={analyzeCanvasSourceNodeAction}>
            <input type="hidden" name="nodeId" value={id} />
            <input
              type="hidden"
              name="researchItemId"
              value={data.researchItemId}
            />
            <Button type="submit" size="sm" variant="outline" className="h-7 text-[10px]">
              Analyze
            </Button>
          </form>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}

function FrameNodeComponent({
  data,
  selected,
}: NodeProps<Node<CanvasNodeData>>) {
  return (
    <div
      className={`h-full min-h-[160px] min-w-[280px] rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-lowest/40 p-3 ${
        selected ? "ring-2 ring-primary/30" : ""
      }`}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={320}
        minHeight={220}
        lineClassName="!border-primary/40"
        handleClassName="!h-2.5 !w-2.5 !border-primary !bg-surface-primary"
      />
      <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
        Frame
      </p>
      <p className="mt-1 text-sm font-semibold text-on-background">{data.title}</p>
      {data.body ? (
        <p className="mt-1 text-xs text-secondary">{data.body}</p>
      ) : null}
    </div>
  );
}

export const FormCraftNode = memo(FormCraftNodeComponent);
export const FrameNode = memo(FrameNodeComponent);

export const canvasNodeTypes = {
  formcraft: FormCraftNode,
  frame: FrameNode,
};
