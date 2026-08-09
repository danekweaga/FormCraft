export type ProvenanceEntry = {
  sourceType:
    | "task"
    | "project"
    | "brand_brain"
    | "voice_profile"
    | "knowledge"
    | "research"
    | "memory"
    | "performance"
    | "my_content"
    | "analysis";
  sourceId: string;
  sourceTitle: string;
};

export type ContextSource = {
  kind: ProvenanceEntry["sourceType"];
  title: string;
  content: string;
  provenance: ProvenanceEntry;
};

export type ContextBundle = {
  sources: ContextSource[];
  provenance: ProvenanceEntry[];
  /** Human-readable "Used knowledge from:" titles */
  usedFrom: string[];
};
