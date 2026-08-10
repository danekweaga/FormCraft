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

export const analysisSourceTypes = [
  "my_content",
  "external_research",
  "draft",
  "unpublished_video",
  "script_only",
  "transcript_only",
] as const;

export const qualitativeRatings = [
  "Excellent",
  "Strong",
  "Good",
  "Needs Work",
  "Weak",
  "Unable to Evaluate",
] as const;

export const improvementPriorities = ["high", "medium", "optional"] as const;

export const overviewSchema = z.object({
  topic: z.string(),
  intendedAudience: z.string().nullable(),
  coreMessage: z.string(),
  contentGoal: z.string().nullable(),
});

export const timelineEntrySchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nonnegative(),
  type: z.string(),
  transcript: z.string(),
  purpose: z.string(),
  assessment: z.string(),
  /** Legacy display labels kept for older UI/helpers */
  startLabel: z.string().optional(),
  endLabel: z.string().optional(),
  segment: z.string().optional(),
  notes: z.string().optional(),
});

export const hookEntrySchema = z.object({
  timestamp: z.number().nonnegative(),
  text: z.string(),
  type: z.string(),
  mechanisms: z.array(z.string()).default([]),
  explanation: z.string(),
  assessment: z.string(),
  improvements: z.array(z.string()).default([]),
  effectiveness: z.enum(["strong", "moderate", "weak"]).optional(),
  notes: z.string().optional(),
});

export const rehookEntrySchema = z.object({
  timestamp: z.number().nonnegative(),
  text: z.string(),
  type: z.string(),
  purpose: z.string(),
  assessment: z.string(),
});

export const openLoopSchema = z.object({
  createdAt: z.number().nonnegative(),
  resolvedAt: z.number().nullable(),
  questionCreated: z.string(),
  assessment: z.string(),
  text: z.string().optional(),
  resolved: z.boolean().optional(),
  notes: z.string().optional(),
});

export const psychologyEntrySchema = z.object({
  mechanism: z.string(),
  evidence: z.string(),
  timestamp: z.number().nullable(),
  interpretation: z.string(),
  technique: z.string().optional(),
  example: z.string().optional(),
  notes: z.string().optional(),
});

export const retentionDeviceSchema = z.object({
  timestamp: z.number().nonnegative(),
  type: z.string(),
  explanation: z.string(),
  device: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export const retentionRiskSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nonnegative(),
  reason: z.string(),
  recommendation: z.string(),
  risk: z.string().optional(),
  severity: z.enum(["low", "medium", "high"]).optional(),
  suggestion: z.string().optional(),
});

export const claimSchema = z.object({
  claim: z.string(),
  claimType: z.string(),
  evidenceProvided: z.array(z.string()).default([]),
  assessment: z.string(),
  supported: z.boolean().optional(),
  notes: z.string().optional(),
});

export const improvementSchema = z.object({
  priority: z.enum(improvementPriorities),
  timestamp: z.number().nullable(),
  issue: z.string(),
  whyItMatters: z.string(),
  recommendation: z.string(),
  example: z.string().nullable(),
  area: z.string().optional(),
  suggestion: z.string().optional(),
});

export const improvedStructureEntrySchema = z.object({
  section: z.string(),
  purpose: z.string(),
  suggestedDuration: z.string(),
});

export const scorecardEntrySchema = z.object({
  category: z.string(),
  rating: z.enum(qualitativeRatings),
  explanation: z.string(),
  score: z.number().min(0).max(10).optional(),
  rationale: z.string().optional(),
});

export const sourceUsedSchema = z.object({
  sourceType: z.string(),
  sourceId: z.string(),
});

export const visualObservationSchema = z.object({
  timestamp: z.number().nullable(),
  observation: z.string(),
  frameReference: z.string().nullable(),
});

export const editingMapEntrySchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nullable(),
  observation: z.string(),
});

export const analysisResultSchema = z.object({
  overview: overviewSchema,
  timeline: z.array(timelineEntrySchema),
  hooks: z.array(hookEntrySchema),
  rehooks: z.array(rehookEntrySchema).default([]),
  openLoops: z.array(openLoopSchema),
  psychology: z.array(psychologyEntrySchema),
  retentionDevices: z.array(retentionDeviceSchema),
  retentionRisks: z.array(retentionRiskSchema).default([]),
  potentialRetentionRisks: z.array(retentionRiskSchema).optional(),
  claims: z.array(claimSchema),
  strengths: z.array(z.string()),
  improvements: z.array(improvementSchema),
  improvedHooks: z.array(z.string()),
  improvedStructure: z.array(improvedStructureEntrySchema).default([]),
  recommendedStructure: z.string().optional(),
  scorecard: z.array(scorecardEntrySchema),
  sourcesUsed: z.array(sourceUsedSchema).default([]),
  confidenceNotes: z.array(z.string()),
  visualObservations: z.array(visualObservationSchema).default([]),
  editingMap: z.array(editingMapEntrySchema).default([]),
  observedRetention: z
    .array(
      z.object({
        startSeconds: z.number(),
        endSeconds: z.number(),
        note: z.string(),
      }),
    )
    .default([]),
  hookStack: z
    .object({
      primary: z.string().nullable(),
      mechanisms: z.array(z.string()),
      assessment: z.string(),
    })
    .optional(),
  rewrittenScript: z.string().nullable().optional(),
});

export const createAnalysisInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  transcript: z.string().trim().min(20).max(200_000),
  mode: z.enum(analysisModes).default("deep"),
  subjectType: z.enum(analysisSubjectTypes).default("unknown"),
  sourceType: z.enum(analysisSourceTypes).optional(),
  parentAnalysisId: z.string().uuid().optional().nullable(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type CreateAnalysisInput = z.infer<typeof createAnalysisInputSchema>;
export type AnalysisMode = (typeof analysisModes)[number];
export type AnalysisSourceType = (typeof analysisSourceTypes)[number];

export type ProcessingStage = {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error" | "skipped";
  detail?: string;
};

export function scoreToRating(
  score: number,
): (typeof qualitativeRatings)[number] {
  if (score >= 9) return "Excellent";
  if (score >= 7) return "Strong";
  if (score >= 5) return "Good";
  if (score >= 3) return "Needs Work";
  return "Weak";
}

/** Normalize legacy or partial results into the Growth I shape. */
export function normalizeAnalysisResult(raw: unknown): AnalysisResult {
  const parsed = analysisResultSchema.safeParse(raw);
  if (parsed.success) {
    const data = parsed.data;
    if (!data.retentionRisks.length && data.potentialRetentionRisks?.length) {
      return {
        ...data,
        retentionRisks: data.potentialRetentionRisks,
      };
    }
    return data;
  }

  const r = (raw ?? {}) as Record<string, unknown>;
  const overviewRaw = r.overview;
  const overview =
    typeof overviewRaw === "object" && overviewRaw !== null
      ? overviewSchema.parse({
          topic: String((overviewRaw as { topic?: string }).topic ?? "Untitled"),
          intendedAudience:
            (overviewRaw as { intendedAudience?: string | null })
              .intendedAudience ?? null,
          coreMessage: String(
            (overviewRaw as { coreMessage?: string }).coreMessage ??
              (typeof overviewRaw === "string" ? overviewRaw : "Analysis"),
          ),
          contentGoal:
            (overviewRaw as { contentGoal?: string | null }).contentGoal ?? null,
        })
      : {
          topic: "Transcript analysis",
          intendedAudience: null,
          coreMessage: typeof overviewRaw === "string" ? overviewRaw : "Analysis",
          contentGoal: null,
        };

  const legacyTimeline = Array.isArray(r.timeline) ? r.timeline : [];
  const timeline = legacyTimeline.map((entry, index) => {
    const e = entry as Record<string, unknown>;
    const startSeconds =
      typeof e.startSeconds === "number"
        ? e.startSeconds
        : index * 8;
    const endSeconds =
      typeof e.endSeconds === "number" ? e.endSeconds : startSeconds + 8;
    return {
      startSeconds,
      endSeconds,
      type: String(e.type ?? e.purpose ?? "Section"),
      transcript: String(e.transcript ?? e.segment ?? ""),
      purpose: String(e.purpose ?? "Development"),
      assessment: String(e.assessment ?? e.notes ?? ""),
      startLabel: e.startLabel ? String(e.startLabel) : undefined,
      endLabel: e.endLabel ? String(e.endLabel) : undefined,
      segment: e.segment ? String(e.segment) : undefined,
      notes: e.notes ? String(e.notes) : undefined,
    };
  });

  const hooks = (Array.isArray(r.hooks) ? r.hooks : []).map((h, i) => {
    const e = h as Record<string, unknown>;
    return {
      timestamp: typeof e.timestamp === "number" ? e.timestamp : i === 0 ? 0 : i * 5,
      text: String(e.text ?? ""),
      type: String(e.type ?? "Statement"),
      mechanisms: Array.isArray(e.mechanisms)
        ? (e.mechanisms as string[])
        : [String(e.type ?? "Statement")],
      explanation: String(e.explanation ?? e.notes ?? ""),
      assessment: String(e.assessment ?? e.effectiveness ?? "moderate"),
      improvements: Array.isArray(e.improvements)
        ? (e.improvements as string[])
        : [],
      effectiveness: e.effectiveness as "strong" | "moderate" | "weak" | undefined,
      notes: e.notes ? String(e.notes) : undefined,
    };
  });

  const improvements = (Array.isArray(r.improvements) ? r.improvements : []).map(
    (item) => {
      const e = item as Record<string, unknown>;
      const priorityRaw = String(e.priority ?? "medium");
      const priority =
        priorityRaw === "high" || priorityRaw === "optional"
          ? priorityRaw
          : priorityRaw === "low"
            ? "optional"
            : "medium";
      return {
        priority: priority as "high" | "medium" | "optional",
        timestamp: typeof e.timestamp === "number" ? e.timestamp : null,
        issue: String(e.issue ?? e.area ?? "Improvement"),
        whyItMatters: String(e.whyItMatters ?? e.notes ?? "May affect clarity or retention."),
        recommendation: String(e.recommendation ?? e.suggestion ?? ""),
        example: e.example != null ? String(e.example) : null,
        area: e.area ? String(e.area) : undefined,
        suggestion: e.suggestion ? String(e.suggestion) : undefined,
      };
    },
  );

  const scorecard = (Array.isArray(r.scorecard) ? r.scorecard : []).map((s) => {
    const e = s as Record<string, unknown>;
    const score = typeof e.score === "number" ? e.score : 5;
    return {
      category: String(e.category ?? "Category"),
      rating:
        typeof e.rating === "string" &&
        qualitativeRatings.includes(e.rating as (typeof qualitativeRatings)[number])
          ? (e.rating as (typeof qualitativeRatings)[number])
          : scoreToRating(score),
      explanation: String(e.explanation ?? e.rationale ?? ""),
      score,
      rationale: e.rationale ? String(e.rationale) : undefined,
    };
  });

  const openLoops = (Array.isArray(r.openLoops) ? r.openLoops : []).map((o, i) => {
    const e = o as Record<string, unknown>;
    return {
      createdAt: typeof e.createdAt === "number" ? e.createdAt : i * 10,
      resolvedAt: typeof e.resolvedAt === "number" ? e.resolvedAt : null,
      questionCreated: String(e.questionCreated ?? e.text ?? ""),
      assessment: String(e.assessment ?? e.notes ?? ""),
      text: e.text ? String(e.text) : undefined,
      resolved: typeof e.resolved === "boolean" ? e.resolved : undefined,
      notes: e.notes ? String(e.notes) : undefined,
    };
  });

  const psychology = (Array.isArray(r.psychology) ? r.psychology : []).map(
    (p) => {
      const e = p as Record<string, unknown>;
      return {
        mechanism: String(e.mechanism ?? e.technique ?? "Mechanism"),
        evidence: String(e.evidence ?? e.example ?? ""),
        timestamp: typeof e.timestamp === "number" ? e.timestamp : null,
        interpretation: String(e.interpretation ?? e.notes ?? "May influence attention."),
        technique: e.technique ? String(e.technique) : undefined,
        example: e.example ? String(e.example) : undefined,
        notes: e.notes ? String(e.notes) : undefined,
      };
    },
  );

  const retentionDevices = (
    Array.isArray(r.retentionDevices) ? r.retentionDevices : []
  ).map((d, i) => {
    const e = d as Record<string, unknown>;
    return {
      timestamp: typeof e.timestamp === "number" ? e.timestamp : i * 8,
      type: String(e.type ?? e.device ?? "Device"),
      explanation: String(e.explanation ?? e.notes ?? ""),
      device: e.device ? String(e.device) : undefined,
      location: e.location ? String(e.location) : undefined,
      notes: e.notes ? String(e.notes) : undefined,
    };
  });

  const riskSource = Array.isArray(r.retentionRisks)
    ? r.retentionRisks
    : Array.isArray(r.potentialRetentionRisks)
      ? r.potentialRetentionRisks
      : [];
  const retentionRisks = riskSource.map((risk, i) => {
    const e = risk as Record<string, unknown>;
    return {
      startSeconds:
        typeof e.startSeconds === "number" ? e.startSeconds : i * 10,
      endSeconds: typeof e.endSeconds === "number" ? e.endSeconds : i * 10 + 5,
      reason: String(e.reason ?? e.risk ?? ""),
      recommendation: String(e.recommendation ?? e.suggestion ?? ""),
      risk: e.risk ? String(e.risk) : undefined,
      severity: e.severity as "low" | "medium" | "high" | undefined,
      suggestion: e.suggestion ? String(e.suggestion) : undefined,
    };
  });

  const claims = (Array.isArray(r.claims) ? r.claims : []).map((c) => {
    const e = c as Record<string, unknown>;
    return {
      claim: String(e.claim ?? ""),
      claimType: String(e.claimType ?? (e.supported ? "supported_claim" : "claim")),
      evidenceProvided: Array.isArray(e.evidenceProvided)
        ? (e.evidenceProvided as string[])
        : e.supported
          ? ["In-transcript support language"]
          : [],
      assessment: String(e.assessment ?? e.notes ?? ""),
      supported: typeof e.supported === "boolean" ? e.supported : undefined,
      notes: e.notes ? String(e.notes) : undefined,
    };
  });

  const recommendedStructure =
    typeof r.recommendedStructure === "string" ? r.recommendedStructure : "";
  const improvedStructure = Array.isArray(r.improvedStructure)
    ? (r.improvedStructure as AnalysisResult["improvedStructure"])
    : recommendedStructure
      ? [
          {
            section: "Recommended structure",
            purpose: recommendedStructure.slice(0, 280),
            suggestedDuration: "n/a",
          },
        ]
      : [];

  return analysisResultSchema.parse({
    overview,
    timeline,
    hooks,
    rehooks: Array.isArray(r.rehooks) ? r.rehooks : [],
    openLoops,
    psychology,
    retentionDevices,
    retentionRisks,
    potentialRetentionRisks: retentionRisks,
    claims,
    strengths: Array.isArray(r.strengths) ? r.strengths : [],
    improvements,
    improvedHooks: Array.isArray(r.improvedHooks) ? r.improvedHooks : [],
    improvedStructure,
    recommendedStructure,
    scorecard,
    sourcesUsed: Array.isArray(r.sourcesUsed) ? r.sourcesUsed : [],
    confidenceNotes: Array.isArray(r.confidenceNotes) ? r.confidenceNotes : [],
    visualObservations: Array.isArray(r.visualObservations)
      ? r.visualObservations
      : [],
    editingMap: Array.isArray(r.editingMap) ? r.editingMap : [],
    observedRetention: Array.isArray(r.observedRetention)
      ? r.observedRetention
      : [],
    hookStack: r.hookStack,
    rewrittenScript: r.rewrittenScript ?? null,
  });
}

export function subjectToSourceType(
  subjectType: (typeof analysisSubjectTypes)[number],
  inputType?: string,
): AnalysisSourceType {
  if (inputType === "my_content_post" || subjectType === "own_content") {
    return "my_content";
  }
  if (subjectType === "draft") return "draft";
  if (subjectType === "unpublished") return "unpublished_video";
  if (
    subjectType === "competitor_reference" ||
    subjectType === "viral_outlier" ||
    inputType === "youtube_url" ||
    inputType === "tiktok_url" ||
    inputType === "instagram_url" ||
    inputType === "social_url"
  ) {
    return "external_research";
  }
  if (inputType === "transcript_paste" || inputType === "transcript_file") {
    return "transcript_only";
  }
  return "transcript_only";
}
