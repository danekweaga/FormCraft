import type { CanvasEdgeType, CanvasNodeType } from "./types";

export type TemplateSeedNode = {
  key: string;
  parentKey?: string;
  nodeType: CanvasNodeType;
  title: string;
  body?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export type TemplateSeedEdge = {
  fromKey: string;
  toKey: string;
  edgeType: CanvasEdgeType;
};

export type CanvasTemplateDef = {
  key: string;
  name: string;
  description: string;
  nodes: TemplateSeedNode[];
  edges: TemplateSeedEdge[];
};

export const SYSTEM_CANVAS_TEMPLATES: CanvasTemplateDef[] = [
  {
    key: "viral_research",
    name: "Viral Research Board",
    description: "Outliers → patterns → ideas with lineage room.",
    nodes: [
      {
        key: "frame",
        nodeType: "frame",
        title: "Research lane",
        x: 20,
        y: 20,
        width: 900,
        height: 420,
      },
      {
        key: "outlier",
        nodeType: "external_outlier",
        title: "Drop outlier here",
        body: "Add from Research",
        x: 60,
        y: 80,
      },
      {
        key: "pattern",
        nodeType: "pattern",
        title: "Pattern",
        body: "Abstract reusable mechanism",
        x: 360,
        y: 80,
      },
      {
        key: "idea",
        nodeType: "idea",
        title: "Original idea",
        body: "Your version — not a clone",
        x: 660,
        y: 80,
      },
    ],
    edges: [
      { fromKey: "outlier", toKey: "pattern", edgeType: "extracts" },
      { fromKey: "pattern", toKey: "idea", edgeType: "inspired_by" },
    ],
  },
  {
    key: "video_development",
    name: "Video Development Board",
    description: "Idea → script → draft → analysis → pre-publish.",
    nodes: [
      { key: "idea", nodeType: "idea", title: "Idea", x: 40, y: 80 },
      { key: "script", nodeType: "script", title: "Script", x: 280, y: 80 },
      { key: "draft", nodeType: "draft", title: "Draft", x: 520, y: 80 },
      {
        key: "analysis",
        nodeType: "analysis",
        title: "Breakdown",
        x: 760,
        y: 80,
      },
    ],
    edges: [
      { fromKey: "idea", toKey: "script", edgeType: "converted_into" },
      { fromKey: "script", toKey: "draft", edgeType: "converted_into" },
      { fromKey: "draft", toKey: "analysis", edgeType: "analyzes" },
    ],
  },
  {
    key: "content_series",
    name: "Content Series Board",
    description: "Thesis + episode slots for a recognizable series.",
    nodes: [
      {
        key: "thesis",
        nodeType: "note",
        title: "Series thesis",
        body: "What stays consistent?",
        x: 40,
        y: 60,
      },
      { key: "ep1", nodeType: "idea", title: "Episode 1", x: 320, y: 60 },
      { key: "ep2", nodeType: "idea", title: "Episode 2", x: 560, y: 60 },
      { key: "ep3", nodeType: "idea", title: "Episode 3", x: 800, y: 60 },
    ],
    edges: [
      { fromKey: "thesis", toKey: "ep1", edgeType: "part_of_series" },
      { fromKey: "thesis", toKey: "ep2", edgeType: "part_of_series" },
      { fromKey: "thesis", toKey: "ep3", edgeType: "part_of_series" },
    ],
  },
  {
    key: "experiment",
    name: "Experiment Board",
    description: "Hypothesis, variants, and evidence nodes.",
    nodes: [
      {
        key: "exp",
        nodeType: "experiment",
        title: "Hypothesis",
        x: 40,
        y: 80,
      },
      { key: "a", nodeType: "draft", title: "Variant A", x: 320, y: 40 },
      { key: "b", nodeType: "draft", title: "Variant B", x: 320, y: 180 },
      {
        key: "lesson",
        nodeType: "performance_lesson",
        title: "Lesson",
        x: 600,
        y: 100,
      },
    ],
    edges: [
      { fromKey: "exp", toKey: "a", edgeType: "supports_experiment" },
      { fromKey: "exp", toKey: "b", edgeType: "supports_experiment" },
      { fromKey: "a", toKey: "lesson", edgeType: "resulted_in" },
      { fromKey: "b", toKey: "lesson", edgeType: "resulted_in" },
    ],
  },
  {
    key: "weekly_content",
    name: "Weekly Content Board",
    description: "Plan this week’s publish slots.",
    nodes: [
      { key: "mon", nodeType: "draft", title: "Mon", x: 40, y: 80 },
      { key: "wed", nodeType: "draft", title: "Wed", x: 280, y: 80 },
      { key: "fri", nodeType: "draft", title: "Fri", x: 520, y: 80 },
      {
        key: "notes",
        nodeType: "note",
        title: "Week notes",
        body: "Constraints, experiments, CTAs",
        x: 760,
        y: 80,
      },
    ],
    edges: [],
  },
  {
    key: "product_launch",
    name: "Product Launch Board",
    description: "Launch narrative across channels.",
    nodes: [
      {
        key: "milestone",
        nodeType: "roadmap_milestone",
        title: "Launch milestone",
        x: 40,
        y: 80,
      },
      { key: "teaser", nodeType: "idea", title: "Teaser", x: 320, y: 40 },
      { key: "demo", nodeType: "idea", title: "Demo", x: 320, y: 160 },
      {
        key: "follow",
        nodeType: "idea",
        title: "Follow-up",
        x: 560,
        y: 100,
      },
    ],
    edges: [
      { fromKey: "milestone", toKey: "teaser", edgeType: "part_of_project" },
      { fromKey: "milestone", toKey: "demo", edgeType: "part_of_project" },
      { fromKey: "demo", toKey: "follow", edgeType: "converted_into" },
    ],
  },
  {
    key: "audience_research",
    name: "Audience Research Board",
    description: "Audience clusters → content opportunities.",
    nodes: [
      {
        key: "cluster",
        nodeType: "audience_insight",
        title: "Audience cluster",
        x: 40,
        y: 80,
      },
      {
        key: "gap",
        nodeType: "note",
        title: "Content gap",
        x: 320,
        y: 80,
      },
      { key: "idea", nodeType: "idea", title: "Response idea", x: 600, y: 80 },
    ],
    edges: [
      { fromKey: "cluster", toKey: "gap", edgeType: "evidence_for" },
      { fromKey: "gap", toKey: "idea", edgeType: "inspired_by" },
    ],
  },
];

export function getSystemTemplate(key: string): CanvasTemplateDef | null {
  return SYSTEM_CANVAS_TEMPLATES.find((t) => t.key === key) ?? null;
}
