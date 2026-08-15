export type ModelTier = "cheap" | "standard" | "premium" | "multimodal";

export const CONTEXT_TASK_TYPES = [
  "content_analysis",
  "idea_evaluation",
  "idea_generation",
  "script_generation",
  "roadmap_review",
  "experiment_analysis",
  "audience_analysis",
  "performance_review",
  "pre_publish_review",
  "editing_guidance",
  "today_recommendation",
  "content_classification",
  "lesson_generation",
  "weekly_review",
  "research_analysis",
  "content_remix",
] as const;

export type ContextTaskType = (typeof CONTEXT_TASK_TYPES)[number];

export const CONTEXT_BUDGETS: Record<ModelTier, number> = {
  cheap: 2_500,
  standard: 6_000,
  premium: 12_000,
  multimodal: 8_000,
};

export const TASK_MODEL_TIER: Record<ContextTaskType, ModelTier> = {
  // Cheap = DeepSeek — tagging / light automation
  content_classification: "cheap",
  audience_analysis: "cheap",
  lesson_generation: "cheap",
  today_recommendation: "cheap",
  // Standard = Gemini — mid-weight synthesis
  idea_evaluation: "standard",
  experiment_analysis: "standard",
  roadmap_review: "standard",
  content_remix: "standard",
  // Premium = Claude — deep creator judgment
  content_analysis: "premium",
  performance_review: "premium",
  weekly_review: "premium",
  research_analysis: "premium",
  pre_publish_review: "premium",
  idea_generation: "premium",
  script_generation: "premium",
  editing_guidance: "premium",
};

export const TASK_DEFINITIONS: Array<{
  taskType: ContextTaskType;
  label: string;
  description: string;
  group: "Analysis" | "Creation" | "Strategy" | "Automation";
}> = [
  { taskType: "content_analysis", label: "Content analysis", description: "Deep transcript and owned-post breakdowns.", group: "Analysis" },
  { taskType: "performance_review", label: "Performance review", description: "Account and post performance interpretation.", group: "Analysis" },
  { taskType: "experiment_analysis", label: "Experiment analysis", description: "Compare experiment variants and evidence.", group: "Analysis" },
  { taskType: "audience_analysis", label: "Audience analysis", description: "Cluster questions, pain points, and requests.", group: "Analysis" },
  { taskType: "idea_evaluation", label: "Idea evaluation", description: "Score and reshape ideas in Idea Gate.", group: "Strategy" },
  { taskType: "roadmap_review", label: "Roadmap review", description: "Review progress, bottlenecks, and next steps.", group: "Strategy" },
  { taskType: "weekly_review", label: "Weekly review", description: "Summarize progress and evidence across the week.", group: "Strategy" },
  { taskType: "research_analysis", label: "Research outlier analysis", description: "Extract hooks, topics, and testable patterns from saved research evidence.", group: "Analysis" },
  { taskType: "content_remix", label: "Content remix", description: "Combine proven hooks and topics from your own evidence.", group: "Creation" },
  { taskType: "today_recommendation", label: "Today recommendation", description: "Choose the most useful next creator action.", group: "Strategy" },
  { taskType: "pre_publish_review", label: "Pre-publish review", description: "Critique a script before publishing.", group: "Creation" },
  { taskType: "idea_generation", label: "Idea generation", description: "Generate evidence-grounded content ideas.", group: "Creation" },
  { taskType: "script_generation", label: "Script generation", description: "Draft scripts using your FormCraft context.", group: "Creation" },
  { taskType: "editing_guidance", label: "Editing guidance", description: "Detailed editing and retention recommendations.", group: "Creation" },
  { taskType: "content_classification", label: "Content classification", description: "Tag topic, hook, mode, and structure.", group: "Automation" },
  { taskType: "lesson_generation", label: "Lesson generation", description: "Turn repeated evidence into testable lessons.", group: "Automation" },
];

export type TaskModelSelection = {
  taskType: ContextTaskType;
  modelTier: ModelTier;
  modelName: string;
  source: "preference" | "environment_default";
};

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmResult = {
  text: string;
  modelName: string;
  modelTier: ModelTier;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  actualCostUsd: number | null;
  usedLlm: boolean;
};
