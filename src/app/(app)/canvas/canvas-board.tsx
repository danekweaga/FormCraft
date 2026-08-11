"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { openGlobalQuickCapture } from "@/components/canvas/global-quick-capture";
import { Button } from "@/components/ui/button";
import {
  createCanvasEdgeAction,
  deleteCanvasEdgesAction,
  deleteCanvasNodesAction,
  duplicateCanvasNodesAction,
  groupCanvasNodesAction,
  persistCanvasGraphAction,
  runCanvasAiAction,
  saveCanvasViewportAction,
  ungroupCanvasFrameAction,
  updateCanvasNodePositionsBatchAction,
} from "./actions";
import { canvasNodeTypes } from "./canvas-nodes";
import {
  CANVAS_AI_ACTIONS,
  CANVAS_AI_ACTION_LABELS,
  type CanvasAiAction,
} from "@/lib/canvas/multi-node-ai";
import {
  type CanvasGraphSnapshot,
  type CanvasNodeData,
} from "@/lib/canvas/persistence";
import {
  CANVAS_EDGE_TYPES,
  CANVAS_EDGE_LABELS,
  normalizeEdgeType,
} from "@/lib/canvas/types";

type HistorySnap = {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
};

type NodeMenu = {
  nodeId: string;
  isFrame: boolean;
  x: number;
  y: number;
};

function numericSize(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function canvasGraphSnapshot(
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
): CanvasGraphSnapshot {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      nodeType: node.data.nodeType,
      title: node.data.title,
      body: node.data.body,
      payload: node.data.payload ?? {},
      position: { x: node.position.x, y: node.position.y },
      width:
        numericSize(node.measured?.width) ??
        numericSize(node.width) ??
        numericSize(node.style?.width),
      height:
        numericSize(node.measured?.height) ??
        numericSize(node.height) ??
        numericSize(node.style?.height),
      parentFrameId:
        node.parentId ?? node.data.parentFrameId ?? null,
      researchItemId: node.data.researchItemId,
      ideaGateEvaluationId: node.data.ideaGateEvaluationId,
      contentPostId: node.data.contentPostId ?? null,
      analysisId: node.data.analysisId ?? null,
      experimentId: node.data.experimentId ?? null,
      knowledgeDocumentId: node.data.knowledgeDocumentId ?? null,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      edgeType: normalizeEdgeType(String(edge.data?.edgeType ?? edge.label ?? "")),
    })),
  };
}

function CanvasBoardInner({
  boardId,
  initialNodes,
  initialEdges,
  initialViewport,
}: {
  boardId: string;
  initialNodes: Node<CanvasNodeData>[];
  initialEdges: Edge[];
  initialViewport?: Viewport;
}) {
  const [nodes, setNodes, applyNodeChanges] = useNodesState(initialNodes);
  const [edges, setEdges, applyEdgeChanges] = useEdgesState(initialEdges);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [edgeType, setEdgeType] = useState<(typeof CANVAS_EDGE_TYPES)[number]>(
    "related_to",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [nodeMenu, setNodeMenu] = useState<NodeMenu | null>(null);
  const [pending, start] = useTransition();
  const { fitView, setViewport } = useReactFlow();
  const router = useRouter();
  const historyRef = useRef<HistorySnap[]>([]);
  const futureRef = useRef<HistorySnap[]>([]);
  const copiedNodeIdsRef = useRef<string[]>([]);
  const resizingNodeIdsRef = useRef(new Set<string>());

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  useEffect(() => {
    if (initialViewport) void setViewport(initialViewport);
  }, [initialViewport, setViewport]);

  const pushHistory = useCallback(() => {
    historyRef.current.push({
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    });
    if (historyRef.current.length > 40) historyRef.current.shift();
    futureRef.current = [];
  }, [nodes, edges]);

  const persistGraph = useCallback(
    async (nextNodes: Node<CanvasNodeData>[], nextEdges: Edge[]) => {
      const result = await persistCanvasGraphAction({
        boardId,
        snapshot: canvasGraphSnapshot(nextNodes, nextEdges),
      });
      if (result.error) setMessage(result.error);
    },
    [boardId],
  );

  const undo = useCallback(() => {
    const previous = historyRef.current.pop();
    if (!previous) {
      setMessage("Nothing to undo.");
      return;
    }
    futureRef.current.push({
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    });
    setNodes(previous.nodes);
    setEdges(previous.edges);
    start(async () => persistGraph(previous.nodes, previous.edges));
  }, [nodes, edges, persistGraph, setNodes, setEdges]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) {
      setMessage("Nothing to redo.");
      return;
    }
    historyRef.current.push({
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    });
    setNodes(next.nodes);
    setEdges(next.edges);
    start(async () => persistGraph(next.nodes, next.edges));
  }, [nodes, edges, persistGraph, setNodes, setEdges]);

  const deleteItems = useCallback(
    (nodeIds: string[], edgeIds: string[]) => {
      if (!nodeIds.length && !edgeIds.length) return;
      pushHistory();
      setNodes((current) => current.filter((node) => !nodeIds.includes(node.id)));
      setEdges((current) =>
        current.filter(
          (edge) =>
            !edgeIds.includes(edge.id) &&
            !nodeIds.includes(edge.source) &&
            !nodeIds.includes(edge.target),
        ),
      );
      start(async () => {
        if (edgeIds.length) {
          await deleteCanvasEdgesAction({ boardId, edgeIds });
        }
        if (nodeIds.length) {
          await deleteCanvasNodesAction({ boardId, nodeIds });
        }
      });
    },
    [boardId, pushHistory, setNodes, setEdges],
  );

  const duplicateItems = useCallback(
    (nodeIds: string[]) => {
      if (!nodeIds.length) return;
      pushHistory();
      start(async () => {
        const result = await duplicateCanvasNodesAction({ boardId, nodeIds });
        if (result.error) setMessage(result.error);
        else {
          setMessage("Duplicated selection.");
          router.refresh();
        }
      });
    },
    [boardId, pushHistory, router],
  );

  const selectAll = useCallback(() => {
    const nodeIds = nodes
      .filter((node) => node.data.nodeType !== "frame")
      .map((node) => node.id);
    const nodeIdSet = new Set(nodeIds);
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: nodeIdSet.has(node.id),
      })),
    );
    setSelectedNodeIds(nodeIds);
    setSelectedEdgeIds([]);
  }, [nodes, setNodes]);

  const groupSelection = useCallback(() => {
    if (selectedNodeIds.length < 2) {
      setMessage("Select at least two ungrouped nodes.");
      return;
    }
    pushHistory();
    start(async () => {
      const result = await groupCanvasNodesAction({
        boardId,
        nodeIds: selectedNodeIds,
      });
      setMessage(result.error ?? "Grouped selection in a frame.");
      if (!result.error) router.refresh();
    });
  }, [boardId, selectedNodeIds, pushHistory, router]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "a" && !isTypingTarget(event.target)) {
        event.preventDefault();
        selectAll();
        return;
      }
      if (meta && event.key.toLowerCase() === "z" && !event.shiftKey) {
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        undo();
        return;
      }
      if (
        meta &&
        (event.key.toLowerCase() === "y" ||
          (event.key.toLowerCase() === "z" && event.shiftKey))
      ) {
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        redo();
        return;
      }
      if (meta && event.key.toLowerCase() === "c" && !isTypingTarget(event.target)) {
        if (!selectedNodeIds.length) return;
        event.preventDefault();
        copiedNodeIdsRef.current = [...selectedNodeIds];
        setMessage(`Copied ${selectedNodeIds.length} node(s).`);
        return;
      }
      if (meta && event.key.toLowerCase() === "v" && !isTypingTarget(event.target)) {
        if (!copiedNodeIdsRef.current.length) return;
        event.preventDefault();
        duplicateItems(copiedNodeIdsRef.current);
        return;
      }
      if (meta && event.key.toLowerCase() === "g" && !isTypingTarget(event.target)) {
        event.preventDefault();
        groupSelection();
        return;
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        !isTypingTarget(event.target) &&
        (selectedNodeIds.length || selectedEdgeIds.length)
      ) {
        event.preventDefault();
        deleteItems(selectedNodeIds, selectedEdgeIds);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    undo,
    redo,
    selectedNodeIds,
    selectedEdgeIds,
    duplicateItems,
    groupSelection,
    deleteItems,
    selectAll,
  ]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      pushHistory();
      const edgeId = crypto.randomUUID();
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: edgeId,
            label: CANVAS_EDGE_LABELS[edgeType],
            data: { edgeType },
          },
          current,
        ),
      );
      start(async () => {
        const result = await createCanvasEdgeAction({
          boardId,
          edgeId,
          fromNodeId: connection.source!,
          toNodeId: connection.target!,
          edgeType,
        });
        if (result.error) {
          setEdges((current) => current.filter((edge) => edge.id !== edgeId));
          setMessage(result.error);
        }
      });
    },
    [boardId, edgeType, pushHistory, setEdges],
  );

  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      start(async () => {
        await updateCanvasNodePositionsBatchAction({
          boardId,
          updates: [
            {
              id: node.id,
              x: node.position.x,
              y: node.position.y,
              width: node.measured?.width ?? undefined,
              height: node.measured?.height ?? undefined,
            },
          ],
        });
      });
    },
    [boardId],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<CanvasNodeData>>[]) => {
      for (const change of changes) {
        if (change.type !== "dimensions") continue;
        if (change.resizing && !resizingNodeIdsRef.current.has(change.id)) {
          resizingNodeIdsRef.current.add(change.id);
          pushHistory();
        }
        if (change.resizing === false && change.dimensions) {
          resizingNodeIdsRef.current.delete(change.id);
          const node = nodes.find((item) => item.id === change.id);
          if (!node) continue;
          start(async () => {
            await updateCanvasNodePositionsBatchAction({
              boardId,
              updates: [
                {
                  id: change.id,
                  x: node.position.x,
                  y: node.position.y,
                  width: change.dimensions!.width,
                  height: change.dimensions!.height,
                },
              ],
            });
          });
        }
      }
      applyNodeChanges(changes);
    },
    [applyNodeChanges, boardId, nodes, pushHistory],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodeIds(params.nodes.map((node) => node.id));
    setSelectedEdgeIds(params.edges.map((edge) => edge.id));
  }, []);

  const onMoveEnd = useCallback(
    (_: unknown, viewport: Viewport) => {
      start(async () => saveCanvasViewportAction({ boardId, viewport }));
    },
    [boardId],
  );

  const runAi = (action: CanvasAiAction) => {
    if (selectedNodeIds.length < 1) {
      setMessage("Select one or more nodes first.");
      return;
    }
    pushHistory();
    start(async () => {
      const result = await runCanvasAiAction({
        boardId,
        action,
        nodeIds: selectedNodeIds,
      });
      setMessage(result.error ?? result.success ?? null);
      if (!result.error) router.refresh();
    });
  };

  const normalizedSearch = search.trim().toLowerCase();
  const matchingNodeIds = useMemo(() => {
    if (!normalizedSearch) return new Set(nodes.map((node) => node.id));
    return new Set(
      nodes
        .filter((node) =>
          [node.data.title, node.data.body, node.data.nodeType]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch),
        )
        .map((node) => node.id),
    );
  }, [nodes, normalizedSearch]);
  const visibleNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        hidden: !matchingNodeIds.has(node.id),
      })),
    [nodes, matchingNodeIds],
  );
  const visibleEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        hidden:
          !matchingNodeIds.has(edge.source) || !matchingNodeIds.has(edge.target),
      })),
    [edges, matchingNodeIds],
  );
  const nodeTypes = useMemo(() => canvasNodeTypes, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-primary p-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search nodes…"
          aria-label="Search Canvas nodes"
          className="h-9 min-w-44 flex-1 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-xs"
        />
        <select
          className="h-9 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2 text-xs"
          value={edgeType}
          onChange={(event) =>
            setEdgeType(event.target.value as (typeof CANVAS_EDGE_TYPES)[number])
          }
          title="Edge type for new connections"
        >
          {CANVAS_EDGE_TYPES.map((type) => (
            <option key={type} value={type}>
              {CANVAS_EDGE_LABELS[type]}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!nodes.some((node) => node.data.nodeType !== "frame")}
          onClick={selectAll}
          title="Select all content nodes (Ctrl/Cmd+A)"
        >
          Select all
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selectedNodeIds.length || pending}
          onClick={() => duplicateItems(selectedNodeIds)}
        >
          Duplicate
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={selectedNodeIds.length < 2 || pending}
          onClick={groupSelection}
          title="Group selected nodes (Ctrl/Cmd+G)"
        >
          Group
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={undo}>
          Undo
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={redo}>
          Redo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={openGlobalQuickCapture}
        >
          Capture (⌘/Ctrl+K)
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => fitView()}>
          Fit
        </Button>
        <select
          className="h-9 max-w-[210px] rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2 text-xs"
          defaultValue=""
          disabled={pending || selectedNodeIds.length < 1}
          onChange={(event) => {
            const value = event.target.value as CanvasAiAction;
            event.target.value = "";
            if (value) runAi(value);
          }}
        >
          <option value="">AI on selection…</option>
          {CANVAS_AI_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {CANVAS_AI_ACTION_LABELS[action]}
            </option>
          ))}
        </select>
      </div>

      {message ? (
        <p className="text-sm text-secondary" role="status">
          {message}
        </p>
      ) : null}

      <div className="h-[min(70vh,720px)] overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
        <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={applyEdgeChanges}
          onConnect={onConnect}
          onNodeDragStart={pushHistory}
          onNodeDragStop={onNodeDragStop}
          onSelectionChange={onSelectionChange}
          onMoveEnd={onMoveEnd}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            setNodeMenu({
              nodeId: node.id,
              isFrame: node.data.nodeType === "frame",
              x: event.clientX,
              y: event.clientY,
            });
          }}
          onPaneClick={() => setNodeMenu(null)}
          nodeTypes={nodeTypes}
          fitView={!initialViewport}
          multiSelectionKeyCode="Shift"
          selectionMode={SelectionMode.Partial}
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} size={1} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      {nodeMenu ? (
        <div
          className="fixed z-[90] w-44 rounded-lg border border-outline-variant/30 bg-surface-primary p-1 paper-shadow"
          style={{ left: nodeMenu.x, top: nodeMenu.y }}
          role="menu"
        >
          <button
            type="button"
            className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-container-low"
            onClick={() => {
              copiedNodeIdsRef.current = [nodeMenu.nodeId];
              setMessage("Copied node. Press Ctrl/Cmd+V to paste.");
              setNodeMenu(null);
            }}
          >
            Copy
          </button>
          <button
            type="button"
            className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-container-low"
            onClick={() => {
              duplicateItems([nodeMenu.nodeId]);
              setNodeMenu(null);
            }}
          >
            Duplicate
          </button>
          {nodeMenu.isFrame ? (
            <button
              type="button"
              className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-container-low"
              onClick={() => {
                pushHistory();
                start(async () => {
                  const result = await ungroupCanvasFrameAction({
                    boardId,
                    frameId: nodeMenu.nodeId,
                  });
                  setMessage(result.error ?? "Frame ungrouped.");
                  if (!result.error) router.refresh();
                });
                setNodeMenu(null);
              }}
            >
              Ungroup frame
            </button>
          ) : null}
          <button
            type="button"
            className="block w-full rounded px-3 py-2 text-left text-sm text-error hover:bg-error/5"
            onClick={() => {
              deleteItems([nodeMenu.nodeId], []);
              setNodeMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

export function CanvasBoard(props: {
  boardId: string;
  initialNodes: Node<CanvasNodeData>[];
  initialEdges: Edge[];
  initialViewport?: Viewport;
}) {
  return (
    <ReactFlowProvider>
      <CanvasBoardInner {...props} />
    </ReactFlowProvider>
  );
}
