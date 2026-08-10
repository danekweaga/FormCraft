export const CANVAS_NODE_TYPES = [
  "source",
  "source_post",
  "external_outlier",
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
  "ai_node",
  "note",
  "frame",
] as const;

export type CanvasNodeType = (typeof CANVAS_NODE_TYPES)[number];

export const CANVAS_EDGE_TYPES = [
  "inspired_by",
  "uses_pattern",
  "source_for",
  "evidence_for",
  "contradicts",
  "similar_to",
  "converted_into",
  "resulted_in",
  "tested_by",
  "supports_experiment",
  "personal_example_for",
  "part_of_series",
  "part_of_project",
  "related_to",
  "analyzes",
  "extracts",
] as const;

export type CanvasEdgeType = (typeof CANVAS_EDGE_TYPES)[number];

export const CANVAS_NODE_LABELS: Record<CanvasNodeType, string> = {
  source: "Source",
  source_post: "Source Post",
  external_outlier: "External Outlier",
  my_content: "My Content",
  video: "Video",
  image: "Image",
  document: "Document",
  website: "Website",
  audio: "Audio",
  voice_note: "Voice Note",
  knowledge: "Knowledge",
  analysis: "Analysis",
  pattern: "Pattern",
  audience_insight: "Audience Insight",
  idea: "Idea",
  script: "Script",
  draft: "Draft",
  experiment: "Experiment",
  performance_lesson: "Performance Lesson",
  roadmap_milestone: "Roadmap Milestone",
  ai_node: "AI Node",
  note: "Note",
  frame: "Frame",
};

export const CANVAS_EDGE_LABELS: Record<CanvasEdgeType, string> = {
  inspired_by: "Inspired By",
  uses_pattern: "Uses Pattern",
  source_for: "Source For",
  evidence_for: "Evidence For",
  contradicts: "Contradicts",
  similar_to: "Similar To",
  converted_into: "Converted Into",
  resulted_in: "Resulted In",
  tested_by: "Tested By",
  supports_experiment: "Supports Experiment",
  personal_example_for: "Personal Example For",
  part_of_series: "Part Of Series",
  part_of_project: "Part Of Project",
  related_to: "Related To",
  analyzes: "Analyzes",
  extracts: "Extracts",
};

export function normalizeNodeType(raw: string): CanvasNodeType {
  if ((CANVAS_NODE_TYPES as readonly string[]).includes(raw)) {
    return raw as CanvasNodeType;
  }
  return "note";
}

export function normalizeEdgeType(raw: string | null | undefined): CanvasEdgeType {
  if (raw && (CANVAS_EDGE_TYPES as readonly string[]).includes(raw)) {
    return raw as CanvasEdgeType;
  }
  const legacy = (raw ?? "").toLowerCase().trim();
  if (legacy === "analyzes") return "analyzes";
  if (legacy === "extracts") return "extracts";
  return "related_to";
}

export function isCanvasNodeType(value: string): value is CanvasNodeType {
  return (CANVAS_NODE_TYPES as readonly string[]).includes(value);
}

export function isCanvasEdgeType(value: string): value is CanvasEdgeType {
  return (CANVAS_EDGE_TYPES as readonly string[]).includes(value);
}
