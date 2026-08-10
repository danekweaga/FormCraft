import type { SupabaseClient } from "@supabase/supabase-js";
import { tryStructuredAI } from "@/lib/ai/client";
import { analyzeTranscriptHeuristic } from "@/lib/analyze/heuristic";
import { z } from "zod";
import type { ResearchAnalysis, ScoredResearchVideo } from "./types";
import { fetchYouTubeTranscript } from "./youtube-transcript";

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
      structureBeats: z.array(z.string()).max(6).optional(),
    }),
  ),
});

function fallbackAnalysis(
  video: ScoredResearchVideo,
  query: string,
  transcriptExcerpt?: string | null,
): ResearchAnalysis {
  if (transcriptExcerpt && transcriptExcerpt.length >= 40) {
    const heuristic = analyzeTranscriptHeuristic(transcriptExcerpt, "quick");
    const hook = heuristic.hooks[0];
    const structureBeats = heuristic.timeline
      .slice(0, 5)
      .map(
        (t) =>
          `${t.startLabel ?? `${Math.round(t.startSeconds)}s`}: ${t.purpose}`,
      );
    return {
      hookText: hook?.text?.slice(0, 280) ?? video.title,
      hookType: hook?.type ?? null,
      topic: query,
      whyItMayWork: [
        video.outlierScore != null
          ? `This video has ${video.outlierScore.toFixed(1)}x the views of the disclosed comparison median.`
          : "Not enough public metric evidence to calculate an outlier score.",
        ...heuristic.openLoops
          .slice(0, 2)
          .map(
            (o) =>
              `Open loop: ${(o.questionCreated || o.text || "").slice(0, 120)}`,
          ),
      ].slice(0, 4),
      reusablePattern:
        heuristic.recommendedStructure ??
        "Test the spoken opening promise with your own evidence.",
      caution:
        "Transcript + metadata analysis — FormCraft did not watch the video. Captions may be incomplete or auto-generated.",
      evidenceBasis: "metadata_and_transcript",
      structureBeats,
    };
  }

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
  /** Optional per-externalId transcript text (YouTube captions, etc.). */
  transcriptsByExternalId?: Map<string, string>;
}): Promise<Map<string, { analysis: ResearchAnalysis; model: string }>> {
  const candidates = params.videos.slice(0, 12);
  const transcripts = params.transcriptsByExternalId ?? new Map<string, string>();

  const fallback = {
    items: candidates.map((video) => ({
      externalId: video.externalId,
      ...fallbackAnalysis(
        video,
        params.query,
        transcripts.get(video.externalId) ?? null,
      ),
    })),
  };

  const result = await tryStructuredAI({
    supabase: params.supabase,
    fallback,
    input: {
      userId: params.userId,
      taskType: "research_analysis",
      role: "standard",
      promptVersion: transcripts.size > 0
        ? "research-outliers-transcript-v1"
        : "research-outliers-v1",
      maxOutputTokens: 1800,
      schema: analysisSchema,
      messages: [
        {
          role: "system",
          content:
            "Analyze public creator-video evidence. Prefer title/description/metrics; when a transcript excerpt is provided, also extract spoken hook, structure, and reusable pattern from that text only. Never claim you watched the video or saw visuals. Never infer retention or causation. Outlier score is unusual views, not proof of why. Set evidenceBasis to metadata_and_transcript only when a transcript excerpt was supplied for that item; otherwise metadata_only. Return JSON exactly matching the schema.",
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
              transcriptExcerpt: transcripts
                .get(video.externalId)
                ?.slice(0, 6000) ?? null,
            })),
          }),
        },
      ],
    },
  });

  return new Map(
    result.data.items.map((item) => {
      const hadTranscript = transcripts.has(item.externalId);
      const fallbackItem = fallback.items.find(
        (f) => f.externalId === item.externalId,
      );
      return [
        item.externalId,
        {
          analysis: {
            hookText: item.hookText,
            hookType: item.hookType,
            topic: item.topic,
            whyItMayWork: item.whyItMayWork,
            reusablePattern: item.reusablePattern,
            caution: item.caution,
            evidenceBasis: hadTranscript
              ? "metadata_and_transcript"
              : "metadata_only",
            structureBeats:
              item.structureBeats ?? fallbackItem?.structureBeats,
          },
          model: result.usedLlm
            ? result.model
            : hadTranscript
              ? "deterministic-transcript-v1"
              : "deterministic-metadata-v1",
        },
      ];
    }),
  );
}

/** Try YouTube captions for a single research video; ignore failures. */
export async function loadOptionalYouTubeTranscript(
  video: ScoredResearchVideo,
): Promise<string | null> {
  if (video.platform !== "youtube") return null;
  return fetchYouTubeTranscript(video.externalId);
}
