import type { SupabaseClient } from "@supabase/supabase-js";
import { tryStructuredAI } from "@/lib/ai/client";
import { z } from "zod";
import type { ResearchAnalysis, ScoredResearchVideo } from "./types";

const analysisSchema = z.object({
  items: z.array(
    z.object({
      externalId: z.string(),
      hookText: z.string().nullable(),
      hookType: z.string().nullable(),
      topic: z.string().nullable(),
      whyItMayWork: z.array(z.string()).max(4),
      reusablePattern: z.string().nullable(),
      caution: z.string(),
      evidenceBasis: z.enum(["metadata_only", "metadata_and_transcript"]),
    }),
  ),
});

function fallbackAnalysis(
  video: ScoredResearchVideo,
  query: string,
): ResearchAnalysis {
  return {
    hookText: video.title,
    hookType: video.title?.trim().endsWith("?") ? "question" : "title_claim",
    topic: query,
    whyItMayWork:
      video.outlierScore !== null
        ? [
            `This video has ${video.outlierScore.toFixed(1)}x the views of the disclosed comparison median.`,
          ]
        : ["Not enough public metric evidence to calculate an outlier score."],
    reusablePattern: video.title
      ? "Test the title's opening promise with your own evidence and point of view."
      : null,
    caution:
      "Metadata-only analysis cannot verify the spoken hook, editing, retention, or causation.",
    evidenceBasis: "metadata_only",
  };
}

export async function analyzeResearchBatch(params: {
  supabase: SupabaseClient;
  userId: string;
  query: string;
  videos: ScoredResearchVideo[];
}): Promise<Map<string, { analysis: ResearchAnalysis; model: string }>> {
  const candidates = params.videos.slice(0, 12);
  const fallback = {
    items: candidates.map((video) => ({
      externalId: video.externalId,
      ...fallbackAnalysis(video, params.query),
    })),
  };
  const result = await tryStructuredAI({
    supabase: params.supabase,
    fallback,
    input: {
      userId: params.userId,
      taskType: "research_analysis",
      role: "standard",
      promptVersion: "research-outliers-v1",
      maxOutputTokens: 1600,
      schema: analysisSchema,
      messages: [
        {
          role: "system",
          content:
            "Analyze public creator-video metadata only. Extract a probable hook from the title/description, topic, and reusable pattern. Never claim you watched the video. Never infer retention or causation. Outlier score is evidence of unusual views, not proof of why. Return JSON exactly matching the schema.",
        },
        {
          role: "user",
          content: JSON.stringify({
            nicheQuery: params.query,
            videos: candidates.map((video) => ({
              externalId: video.externalId,
              title: video.title,
              description: video.description?.slice(0, 1200),
              creator: video.creatorName,
              views: video.views,
              baselineViews: video.baselineViews,
              outlierScore: video.outlierScore,
              scoreBasis: video.scoreBasis,
            })),
          }),
        },
      ],
    },
  });

  return new Map(
    result.data.items.map((item) => [
      item.externalId,
      {
        analysis: {
          hookText: item.hookText,
          hookType: item.hookType,
          topic: item.topic,
          whyItMayWork: item.whyItMayWork,
          reusablePattern: item.reusablePattern,
          caution: item.caution,
          evidenceBasis: item.evidenceBasis,
        },
        model: result.usedLlm ? result.model : "deterministic-metadata-v1",
      },
    ]),
  );
}

