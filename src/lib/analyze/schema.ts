import { z } from "zod";

export const analysisModes = ["quick", "deep", "expert"] as const;
export const analysisSubjectTypes = [
  "own_content",
  "competitor_reference",
  "viral_outlier",
  "draft",
  "unpublished",
  "unknown",
] as const;

export const timelineEntrySchema = z.object({
  startLabel: z.string(),
  endLabel: z.string().optional(),
  segment: z.string(),
  purpose: z.string(),
  notes: z.string().optional(),
});

export const hookEntrySchema = z.object({
  text: z.string(),
  type: z.string(),
  effectiveness: z.enum(["strong", "moderate", "weak"]),
  notes: z.string().optional(),
});

export const openLoopSchema = z.object({
  text: z.string(),
  resolved: z.boolean(),
  notes: z.string().optional(),
});

export const psychologyEntrySchema = z.object({
  technique: z.string(),
  example: z.string(),
  notes: z.string().optional(),
});

export const retentionDeviceSchema = z.object({
  device: z.string(),
  location: z.string(),
  notes: z.string().optional(),
});

export const retentionRiskSchema = z.object({
  risk: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  suggestion: z.string().optional(),
});

export const claimSchema = z.object({
  claim: z.string(),
  supported: z.boolean(),
  notes: z.string().optional(),
});

export const improvementSchema = z.object({
  area: z.string(),
  suggestion: z.string(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export const scorecardEntrySchema = z.object({
  category: z.string(),
  score: z.number().min(0).max(10),
  rationale: z.string(),
});

export const analysisResultSchema = z.object({
  overview: z.string(),
  timeline: z.array(timelineEntrySchema),
  hooks: z.array(hookEntrySchema),
  openLoops: z.array(openLoopSchema),
  psychology: z.array(psychologyEntrySchema),
  retentionDevices: z.array(retentionDeviceSchema),
  potentialRetentionRisks: z.array(retentionRiskSchema),
  claims: z.array(claimSchema),
  strengths: z.array(z.string()),
  improvements: z.array(improvementSchema),
  improvedHooks: z.array(z.string()),
  recommendedStructure: z.string(),
  scorecard: z.array(scorecardEntrySchema),
  confidenceNotes: z.array(z.string()),
});

export const createAnalysisInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  transcript: z.string().trim().min(20).max(200_000),
  mode: z.enum(analysisModes).default("deep"),
  subjectType: z.enum(analysisSubjectTypes).default("unknown"),
  parentAnalysisId: z.string().uuid().optional().nullable(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type CreateAnalysisInput = z.infer<typeof createAnalysisInputSchema>;
