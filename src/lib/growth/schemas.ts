import { z } from "zod";

export const createRoadmapSchema = z.object({
  goal: z.string().trim().min(3, "Goal must be at least 3 characters.").max(500),
  currentPhase: z.string().trim().min(1, "Phase is required.").max(80),
});

export const createMilestoneSchema = z.object({
  roadmapId: z.string().uuid(),
  title: z.string().trim().min(2, "Title is required.").max(200),
  category: z.string().trim().min(1).max(80),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => v || null),
  deadline: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export const createExperimentSchema = z.object({
  hypothesis: z
    .string()
    .trim()
    .min(8, "Hypothesis must be at least 8 characters.")
    .max(2000),
  primaryVariable: z.string().trim().max(200).optional().nullable(),
  primaryMetric: z.string().trim().max(200).optional().nullable(),
  testPlan: z.string().trim().max(4000).optional().nullable(),
});

export const pasteCommentsSchema = z.object({
  comments: z
    .string()
    .trim()
    .min(1, "Paste at least one comment.")
    .max(50_000),
});

export const prePublishSchema = z.object({
  inputText: z
    .string()
    .trim()
    .min(20, "Script must be at least 20 characters.")
    .max(50_000),
  sourceRef: z.string().trim().max(200).optional().nullable(),
  analysisId: z.string().uuid().optional().nullable(),
  contentPostId: z.string().uuid().optional().nullable(),
  creativeDirection: z
    .enum([
      "minimal_yap",
      "clean_explainer",
      "high_energy",
      "storytelling",
      "meme_heavy",
      "my_style",
      "reference",
      "custom",
    ])
    .optional()
    .nullable(),
  customDirectionBrief: z.string().trim().max(2000).optional().nullable(),
  styleProfileId: z.string().uuid().optional().nullable(),
  runEditingCopilot: z.boolean().optional().default(false),
});

export const ideaGateSchema = z.object({
  ideaText: z
    .string()
    .trim()
    .min(8, "Idea must be at least 8 characters.")
    .max(5000),
});
