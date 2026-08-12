import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import type { FormCraftContext } from "@/lib/ai/context/formcraft-context";
import { evaluateIdeaHeuristic } from "./heuristics";

export const ideaGateDecisionSchema = z.object({
  recommendation: z.enum([
    "MAKE IT",
    "PROMISING — FIX THE ANGLE",
    "SAVE FOR LATER",
    "TOO SIMILAR",
    "NEEDS PERSONAL PROOF",
    "DOES NOT FIT CURRENT STRATEGY",
  ]),
  summary: z.string(),
  evidence: z.array(z.string()),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  duplicateRisk: z.enum(["low", "medium", "high"]),
  roadmapFit: z.enum(["low", "medium", "high"]),
  audienceFit: z.enum(["low", "medium", "high"]),
  performanceFit: z.enum(["low", "medium", "high"]),
  experimentOpportunity: z.string().nullable(),
  suggestedAngle: z.string().nullable(),
  suggestedFormat: z.string().nullable(),
  requiredPersonalContext: z.array(z.string()),
  sourcesUsed: z.array(z.string()),
  worthMaking: z.enum(["yes", "reshape", "not_now"]).default("reshape"),
  audienceRelevance: z.string().default("Needs a specific audience problem."),
  brandFitReason: z.string().default("Compare against the saved creator profile."),
  originalityReason: z.string().default("Use a distinct angle, proof, structure, and conclusion."),
  proofAvailable: z.array(z.string()).max(6).default([]),
  bestFormats: z.array(z.string()).max(4).default([]),
  hookAngles: z.array(z.string()).max(5).default([]),
  seriesPotential: z.string().default("Not yet assessed."),
  conversionFit: z.string().default("Match the CTA to the content objective."),
  productionEffort: z.enum(["low", "medium", "high"]).default("medium"),
  claimRisks: z.array(z.string()).max(6).default([]),
  qualityGateStatus: z.enum(["Ready", "Revise", "Rethink", "Verify"]).default("Revise"),
});

export type IdeaGateDecision = z.infer<typeof ideaGateDecisionSchema>;

const PROMPT_VERSION = "idea-gate-content-intelligence-v3";

function normalize(text: string): string {
  return text.toLowerCase().replace(/\W+/g, " ").trim();
}

function jaccard(a: string, b: string): number {
  const as = new Set(normalize(a).split(" ").filter((w) => w.length > 2));
  const bs = new Set(normalize(b).split(" ").filter((w) => w.length > 2));
  if (!as.size || !bs.size) return 0;
  let inter = 0;
  for (const w of as) if (bs.has(w)) inter += 1;
  return inter / (as.size + bs.size - inter);
}

export function detectDuplicateIdea(
  idea: string,
  priorTexts: string[],
): { risk: "low" | "medium" | "high"; match?: string; score: number } {
  let best = { score: 0, match: "" };
  for (const prior of priorTexts) {
    const score = jaccard(idea, prior);
    if (score > best.score) best = { score, match: prior };
  }
  if (best.score >= 0.55)
    return { risk: "high", match: best.match, score: best.score };
  if (best.score >= 0.35)
    return { risk: "medium", match: best.match, score: best.score };
  return { risk: "low", score: best.score };
}

function heuristicDecision(params: {
  idea: string;
  context: FormCraftContext;
  priorTexts: string[];
  dup: ReturnType<typeof detectDuplicateIdea>;
}): IdeaGateDecision {
  const heuristic = evaluateIdeaHeuristic(params.idea);
  const hasAudience = params.context.items.some(
    (i) =>
      i.sourceType === "audience_insight" || i.sourceType === "audience_comment",
  );
  const hasLesson = params.context.items.some(
    (i) => i.sourceType === "performance_lesson",
  );
  const hasExperiment = params.context.items.some(
    (i) => i.sourceType === "experiment",
  );
  const hasRoadmap = params.context.items.some((i) => i.sourceType === "roadmap");

  if (params.dup.risk === "high") {
    return ideaGateDecisionSchema.parse({
      recommendation: "TOO SIMILAR",
      summary:
        "This idea is too close to something you already published or saved.",
      evidence: [
        `Similar to: “${(params.dup.match ?? "").slice(0, 100)}”`,
        `Similarity score: ${params.dup.score.toFixed(2)}`,
      ],
      strengths: [],
      weaknesses: ["Overlaps an existing angle"],
      duplicateRisk: "high",
      roadmapFit: hasRoadmap ? "medium" : "low",
      audienceFit: hasAudience ? "medium" : "low",
      performanceFit: hasLesson ? "medium" : "low",
      experimentOpportunity: null,
      suggestedAngle:
        "Narrow to a more specific skill, story, or objection you have not covered.",
      suggestedFormat: "short-form video",
      requiredPersonalContext: ["A concrete personal example"],
      sourcesUsed: params.context.usedFrom,
    });
  }

  const recommendation =
    heuristic.recommendation === "pursue"
      ? hasAudience || hasLesson
        ? "MAKE IT"
        : "PROMISING — FIX THE ANGLE"
      : heuristic.recommendation === "park"
        ? "SAVE FOR LATER"
        : heuristic.recommendation === "kill"
          ? "DOES NOT FIT CURRENT STRATEGY"
          : "PROMISING — FIX THE ANGLE";

  return ideaGateDecisionSchema.parse({
    recommendation,
    summary: heuristic.why,
    evidence: [
      ...heuristic.evidence,
      ...params.context.usedFrom.slice(0, 4).map((s) => `Context: ${s}`),
    ],
    strengths: hasLesson ? ["Aligns with confirmed performance lessons"] : [],
    weaknesses:
      params.dup.risk === "medium" ? ["Moderate overlap with prior ideas"] : [],
    duplicateRisk: params.dup.risk,
    roadmapFit: hasRoadmap ? "high" : "medium",
    audienceFit: hasAudience ? "high" : "low",
    performanceFit: hasLesson ? "high" : "medium",
    experimentOpportunity: hasExperiment
      ? "May fit an active experiment — confirm before assigning."
      : null,
    suggestedAngle: heuristic.betterAngle,
    suggestedFormat: heuristic.bestFormat,
    requiredPersonalContext: recommendation.includes("PERSONAL")
      ? ["Personal proof or story"]
      : [],
    sourcesUsed: params.context.usedFrom,
  });
}

export async function evaluateIdeaWithContext(params: {
  idea: string;
  context: FormCraftContext;
  priorTexts: string[];
  supabase: SupabaseClient;
  userId: string;
}): Promise<IdeaGateDecision> {
  const dup = detectDuplicateIdea(params.idea, params.priorTexts);
  const fallback = heuristicDecision({
    idea: params.idea,
    context: params.context,
    priorTexts: params.priorTexts,
    dup,
  });

  if (dup.risk === "high") return fallback;

  const cacheKey = hashAiInput([
    PROMPT_VERSION,
    params.idea,
    params.context.usedFrom,
    params.context.items.slice(0, 12).map((i) => i.sourceId),
  ]);

  const result = await tryStructuredAI({
    supabase: params.supabase,
    fallback,
    input: {
      userId: params.userId,
      taskType: "idea_evaluation",
      role: "standard",
      promptVersion: PROMPT_VERSION,
      cacheKey,
      modelName: params.context.modelName,
      maxOutputTokens: 2000,
      schema: ideaGateDecisionSchema,
      messages: [
        {
          role: "system",
          content: [
            "You are FormCraft Idea Gate. Use only provided context. Return JSON matching every IdeaGateDecision schema key.",
            "Recommendations must be one of: MAKE IT | PROMISING — FIX THE ANGLE | SAVE FOR LATER | TOO SIMILAR | NEEDS PERSONAL PROOF | DOES NOT FIT CURRENT STRATEGY. Never invent sources.",
          ].join("\n\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            idea: params.idea,
            usedFrom: params.context.usedFrom,
            context: params.context.items.slice(0, 12).map((i) => ({
              type: i.sourceType,
              title: i.title,
              excerpt: i.excerpt,
            })),
            duplicateRisk: dup.risk,
          }),
        },
      ],
    },
  });

  return {
    ...result.data,
    sourcesUsed: result.data.sourcesUsed.length
      ? result.data.sourcesUsed
      : params.context.usedFrom,
  };
}

/** Map new recommendations onto existing DB enum */
export function toDbRecommendation(
  value: IdeaGateDecision["recommendation"],
): "pursue" | "reshape" | "park" | "kill" {
  switch (value) {
    case "MAKE IT":
      return "pursue";
    case "SAVE FOR LATER":
      return "park";
    case "TOO SIMILAR":
    case "DOES NOT FIT CURRENT STRATEGY":
      return "kill";
    default:
      return "reshape";
  }
}
