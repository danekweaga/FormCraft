export type ResearchPlatform = "youtube" | "instagram" | "tiktok" | "other";

export type ResearchVideoCandidate = {
  platform: ResearchPlatform;
  externalId: string;
  externalUrl: string;
  creatorId: string | null;
  creatorName: string | null;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
};

export type ScoredResearchVideo = ResearchVideoCandidate & {
  baselineViews: number | null;
  outlierScore: number | null;
  scoreBasis: "creator_median" | "niche_cohort_median" | "unavailable";
  baselineSampleSize?: number;
  baselineConfidence?: "low" | "medium" | "high";
  outlierLabel?:
    | "below_baseline"
    | "typical"
    | "emerging"
    | "strong_outlier"
    | "exceptional"
    | null;
};

export type ResearchAnalysis = {
  hookText: string | null;
  hookType: string | null;
  topic: string | null;
  whyItMayWork: string[];
  reusablePattern: string | null;
  caution: string;
  evidenceBasis: "metadata_only" | "metadata_and_transcript";
  /** Present when captions/transcript were available (YouTube). */
  structureBeats?: string[];
  transcriptHook?: string | null;
};

