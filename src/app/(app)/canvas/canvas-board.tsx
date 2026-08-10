"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  analyzeCanvasSourceNodeAction,
  updateCanvasNodePositionAction,
} from "./actions";

const TYPE_STYLES: Record<string, string> = {
  source: "border-primary-container/40 bg-primary-container/5",
  analysis: "border-tertiary/40 bg-tertiary/5",
  pattern: "border-outline-variant/40 bg-surface-container-low",
  idea: "border-primary/40 bg-primary/5",
};

export type CanvasBoardNode = {
  id: string;
  node_type: string;
  title: string;
  body: string | null;
  position_x: number;
  position_y: number;
  research_item_id: string | null;
  idea_gate_evaluation_id: string | null;
  has_analysis?: boolean;
};

export type CanvasBoardEdge = {
  id: string;
  from_node_id: string;
  to_node_id: string;
  label: string | null;
};

export function CanvasBoard({
  initialNodes,
  initialEdges,
}: {
  initialNodes: CanvasBoardNode[];
  initialEdges: CanvasBoardEdge[];
}) {
  const router = useRouter();
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const width = Math.max(
    960,
    ...nodes.map((n) => Number(n.position_x) + 280),
  );
  const height = Math.max(
    520,
    ...nodes.map((n) => Number(n.position_y) + 180),
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      if ((e.target as HTMLElement).closest("button,a")) return;
      const node = nodesRef.current.find((n) => n.id === id);
      if (!node || !boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      const scrollLeft = boardRef.current.parentElement?.scrollLeft ?? 0;
      const scrollTop = boardRef.current.parentElement?.scrollTop ?? 0;
      dragRef.current = {
        id,
        offsetX: e.clientX - rect.left - scrollLeft - Number(node.position_x),
        offsetY: e.clientY - rect.top - scrollTop - Number(node.position_y),
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const scrollLeft = boardRef.current.parentElement?.scrollLeft ?? 0;
    const scrollTop = boardRef.current.parentElement?.scrollTop ?? 0;
    const x = Math.max(0, e.clientX - rect.left - scrollLeft - drag.offsetX);
    const y = Math.max(0, e.clientY - rect.top - scrollTop - drag.offsetY);
    setNodes((prev) =>
      prev.map((n) =>
        n.id === drag.id ? { ...n, position_x: x, position_y: y } : n,
      ),
    );
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const node = nodesRef.current.find((n) => n.id === drag.id);
    if (!node) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    start(async () => {
      const fd = new FormData();
      fd.set("nodeId", node.id);
      fd.set("x", String(Math.round(Number(node.position_x))));
      fd.set("y", String(Math.round(Number(node.position_y))));
      await updateCanvasNodePositionAction(fd);
    });
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-xs text-secondary">
        Drag nodes to rearrange. Positions save automatically. Analyze source
        nodes to attach hook/structure nodes.
      </p>
      {message ? <p className="text-sm text-secondary">{message}</p> : null}
      <div className="overflow-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest paper-shadow">
        <div
          ref={boardRef}
          className="relative touch-none"
          style={{ width, height, minHeight: 520 }}
          onPointerMove={onPointerMove}
        >
          <svg
            className="pointer-events-none absolute inset-0"
            width={width}
            height={height}
          >
            {edges.map((edge) => {
              const from = nodes.find((n) => n.id === edge.from_node_id);
              const to = nodes.find((n) => n.id === edge.to_node_id);
              if (!from || !to) return null;
              const x1 = Number(from.position_x) + 120;
              const y1 = Number(from.position_y) + 48;
              const x2 = Number(to.position_x) + 120;
              const y2 = Number(to.position_y) + 24;
              return (
                <g key={edge.id}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="var(--color-outline)"
                    strokeOpacity="0.45"
                    strokeWidth="1.5"
                  />
                  {edge.label ? (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 4}
                      className="fill-[var(--color-secondary)] text-[10px]"
                      textAnchor="middle"
                    >
                      {edge.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {nodes.map((node) => (
            <div
              key={node.id}
              role="group"
              className={`absolute w-56 cursor-grab rounded-xl border p-3 shadow-sm active:cursor-grabbing ${
                TYPE_STYLES[node.node_type] ?? TYPE_STYLES.source
              }`}
              style={{
                left: Number(node.position_x),
                top: Number(node.position_y),
              }}
              onPointerDown={(e) => onPointerDown(e, node.id)}
              onPointerUp={onPointerUp}
            >
              <Badge variant="default">{node.node_type}</Badge>
              <p className="mt-2 text-sm font-semibold text-on-background">
                {node.title}
              </p>
              {node.body ? (
                <p className="mt-1 line-clamp-4 text-xs text-secondary">
                  {node.body}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {node.research_item_id ? (
                  <Link
                    href="/research?mode=saved"
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Open in Research
                  </Link>
                ) : null}
                {node.idea_gate_evaluation_id ? (
                  <Link
                    href="/idea-gate"
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Idea Gate
                  </Link>
                ) : null}
                {node.node_type === "source" &&
                node.research_item_id &&
                !node.has_analysis ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const fd = new FormData();
                        fd.set("nodeId", node.id);
                        fd.set("researchItemId", node.research_item_id!);
                        const result = await analyzeCanvasSourceNodeAction(fd);
                        setMessage(result.success ?? result.error ?? "Done.");
                        if (result.success) {
                          setNodes((prev) =>
                            prev.map((n) =>
                              n.id === node.id
                                ? { ...n, has_analysis: true }
                                : n,
                            ),
                          );
                          router.refresh();
                        }
                      })
                    }
                  >
                    Analyze
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
