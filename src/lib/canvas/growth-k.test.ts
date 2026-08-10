import { describe, expect, it } from "vitest";
import {
  CANVAS_EDGE_TYPES,
  CANVAS_NODE_TYPES,
  isCanvasEdgeType,
  isCanvasNodeType,
  normalizeEdgeType,
  normalizeNodeType,
} from "./types";
import { SYSTEM_CANVAS_TEMPLATES, getSystemTemplate } from "./templates";
import { dbEdgesToFlow, dbNodesToFlow } from "./persistence";
import { CANVAS_AI_ACTIONS } from "./multi-node-ai";

describe("Growth K canvas", () => {
  it("includes required node and edge taxonomies", () => {
    expect(CANVAS_NODE_TYPES).toEqual(
      expect.arrayContaining([
        "external_outlier",
        "source_post",
        "my_content",
        "video",
        "image",
        "document",
        "website",
        "audio",
        "voice_note",
        "knowledge",
        "analysis",
        "pattern",
        "audience_insight",
        "idea",
        "script",
        "draft",
        "experiment",
        "performance_lesson",
        "roadmap_milestone",
        "frame",
        "ai_node",
        "note",
      ]),
    );
    expect(CANVAS_EDGE_TYPES).toEqual(
      expect.arrayContaining([
        "inspired_by",
        "uses_pattern",
        "source_for",
        "evidence_for",
        "contradicts",
        "similar_to",
        "converted_into",
        "resulted_in",
        "tested_by",
        "part_of_series",
        "supports_experiment",
        "personal_example_for",
        "part_of_project",
        "analyzes",
        "extracts",
      ]),
    );
    expect(isCanvasNodeType("script")).toBe(true);
    expect(isCanvasNodeType("not_a_type")).toBe(false);
    expect(isCanvasEdgeType("inspired_by")).toBe(true);
  });

  it("normalizes legacy source/edge labels", () => {
    expect(normalizeNodeType("source")).toBe("source");
    expect(normalizeNodeType("bogus")).toBe("note");
    expect(normalizeEdgeType("analyzes")).toBe("analyzes");
    expect(normalizeEdgeType("Inspired By")).toBe("related_to");
    expect(normalizeEdgeType("inspired_by")).toBe("inspired_by");
  });

  it("ships system templates with seed nodes/edges", () => {
    expect(SYSTEM_CANVAS_TEMPLATES.map((template) => template.key)).toEqual([
      "viral_research",
      "video_development",
      "content_series",
      "experiment",
      "weekly_content",
      "product_launch",
      "audience_research",
    ]);
    const viral = getSystemTemplate("viral_research");
    expect(viral?.nodes.length).toBeGreaterThan(0);
    expect(viral?.edges.every((e) => isCanvasEdgeType(e.edgeType))).toBe(true);
  });

  it("maps db rows to React Flow nodes/edges", () => {
    const nodes = dbNodesToFlow([
      {
        id: "n1",
        node_type: "idea",
        title: "Hook idea",
        body: "body",
        position_x: 10,
        position_y: 20,
        research_item_id: null,
        idea_gate_evaluation_id: null,
        parent_frame_id: "n2",
        payload: { source: "quick_capture" },
      },
      {
        id: "n2",
        node_type: "frame",
        title: "Lane",
        body: null,
        position_x: 0,
        position_y: 0,
        width: 400,
        height: 200,
        research_item_id: null,
        idea_gate_evaluation_id: null,
      },
    ]);
    expect(nodes.find((node) => node.id === "n1")?.type).toBe("formcraft");
    expect(nodes.find((node) => node.id === "n1")?.position).toEqual({
      x: 10,
      y: 20,
    });
    expect(nodes.find((node) => node.id === "n1")?.parentId).toBe("n2");
    expect(nodes.find((node) => node.id === "n1")?.extent).toBe("parent");
    expect(nodes.find((node) => node.id === "n1")?.data.payload).toEqual({
      source: "quick_capture",
    });
    expect(nodes.find((node) => node.id === "n2")?.type).toBe("frame");

    const edges = dbEdgesToFlow([
      {
        id: "e1",
        from_node_id: "n1",
        to_node_id: "n2",
        label: "analyzes",
        edge_type: "analyzes",
      },
    ]);
    expect(edges[0]?.source).toBe("n1");
    expect(edges[0]?.target).toBe("n2");
    expect(edges[0]?.data).toEqual({ edgeType: "analyzes" });
  });

  it("exposes multi-node AI actions without collaboration features", () => {
    expect(CANVAS_AI_ACTIONS).toEqual([
      "analyze_together",
      "common_patterns",
      "contradictions",
      "generate_ideas",
      "content_gaps",
      "combine_ideas",
      "generate_script",
      "create_series",
      "summarize",
      "audience_problems",
      "compare",
      "missing_research",
    ]);
    expect(CANVAS_AI_ACTIONS).not.toContain("multiplayer");
  });
});
