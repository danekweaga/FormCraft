import { z } from "zod";

export const creativeDirections = [
  "minimal_yap",
  "clean_explainer",
  "high_energy",
  "storytelling",
  "meme_heavy",
  "my_style",
  "reference",
  "custom",
] as const;

export const findingBuckets = [
  "fix_before_posting",
  "worth_testing",
  "creative_options",
  "optional_polish",
] as const;

export const evidenceKinds = [
  "observation",
  "structural_observation",
  "psychology",
  "personal_evidence",
  "creative_suggestion",
  "performance_evidence",
  "current_experiment",
] as const;

export const findingSchema = z.object({
  bucket: z.enum(findingBuckets),
  evidenceKind: z.enum(evidenceKinds),
  timestampStart: z.number().nullable(),
  timestampEnd: z.number().nullable(),
  title: z.string(),
  whyItMatters: z.string(),
  suggestion: z.string(),
  alternatives: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).min(1),
  psychologyPrincipleNames: z.array(z.string()).default([]),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  uncertainty: z.string().default(""),
  suggestedExperiment: z.string().nullable().default(null),
});

export const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
  group: z.enum(["ready", "consider"]),
});

export const prePublishLabResultSchema = z.object({
  version: z.literal("pre-publish-lab-v1"),
  summary: z.string(),
  findings: z.array(findingSchema),
  checks: z.array(
    z.object({
      id: z.string(),
      pass: z.boolean(),
      note: z.string(),
    }),
  ),
  checklist: z.object({
    ready: z.array(checklistItemSchema),
    consider: z.array(checklistItemSchema),
  }),
  activeExperimentNote: z.string().nullable(),
  confidenceNote: z.string(),
  /** Legacy compatibility */
  mode: z.enum(["heuristic_stub", "openrouter_ai"]).optional(),
});

export const blueprintBeatSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nonnegative(),
  content: z.string(),
  keep: z.string(),
  optional: z.string().nullable(),
  why: z.string(),
  evidenceKind: z.enum(["observation", "creative_suggestion"]),
  directionVariants: z
    .array(
      z.object({
        direction: z.string(),
        suggestion: z.string(),
      }),
    )
    .default([]),
});

export const editingBlueprintSchema = z.object({
  version: z.literal("editing-blueprint-v1"),
  creativeDirection: z.enum(creativeDirections),
  summary: z.string(),
  beats: z.array(blueprintBeatSchema),
  stylePrinciplesUsed: z.array(z.string()).default([]),
  confidenceNote: z.string(),
});

export type CreativeDirection = (typeof creativeDirections)[number];
export type FindingBucket = (typeof findingBuckets)[number];
export type PrePublishLabResult = z.infer<typeof prePublishLabResultSchema>;
export type EditingBlueprint = z.infer<typeof editingBlueprintSchema>;
export type PrePublishFinding = z.infer<typeof findingSchema>;

export const CREATIVE_DIRECTION_LABELS: Record<CreativeDirection, string> = {
  minimal_yap: "Minimal Yap",
  clean_explainer: "Clean Explainer",
  high_energy: "High Energy",
  storytelling: "Storytelling",
  meme_heavy: "Meme-Heavy",
  my_style: "My Style",
  reference: "Reference Style",
  custom: "Custom",
};

export const BUCKET_LABELS: Record<FindingBucket, string> = {
  fix_before_posting: "Fix before posting",
  worth_testing: "Worth testing",
  creative_options: "Creative options",
  optional_polish: "Optional polish",
};
