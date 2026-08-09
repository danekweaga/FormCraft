import type { ScoredResearchVideo } from "./types";

export type PersonalEvidence = {
  topics: string[];
  lessons: string[];
  audienceSignals: string[];
  roadmapGoal: string | null;
  activeExperimentHypothesis: string | null;
  dismissedCreators: string[];
};

export type RelevanceResult = {
  score: number;
  reasons: string[];
  personalFit: "strong" | "medium" | "weak";
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);
}

/**
 * Deterministic For You / personal relevance score.
 * Does not call an LLM.
 */
export function scorePersonalRelevance(
  item: ScoredResearchVideo & { topic?: string | null; title?: string | null },
  evidence: PersonalEvidence,
): RelevanceResult {
  const reasons: string[] = [];
  let score = 0;

  if (evidence.dismissedCreators.includes(item.creatorId ?? "")) {
    return { score: -100, reasons: ["You hid this creator"], personalFit: "weak" };
  }

  const hay = tokenize(
    `${item.title ?? ""} ${item.description ?? ""} ${item.topic ?? ""}`,
  );

  for (const topic of evidence.topics) {
    const terms = tokenize(topic);
    if (terms.some((t) => hay.includes(t))) {
      score += 25;
      reasons.push(`Matches your topic: ${topic}`);
      break;
    }
  }

  for (const lesson of evidence.lessons) {
    const terms = tokenize(lesson).slice(0, 6);
    if (terms.filter((t) => hay.includes(t)).length >= 2) {
      score += 15;
      reasons.push(`Aligns with a performance lesson`);
      break;
    }
  }

  for (const signal of evidence.audienceSignals) {
    const terms = tokenize(signal).slice(0, 6);
    if (terms.filter((t) => hay.includes(t)).length >= 2) {
      score += 20;
      reasons.push(`Audience has asked about related themes`);
      break;
    }
  }

  if (evidence.roadmapGoal) {
    const terms = tokenize(evidence.roadmapGoal);
    if (terms.filter((t) => hay.includes(t)).length >= 2) {
      score += 15;
      reasons.push(`Fits current roadmap goal`);
    }
  }

  if (evidence.activeExperimentHypothesis) {
    const terms = tokenize(evidence.activeExperimentHypothesis);
    if (terms.filter((t) => hay.includes(t)).length >= 2) {
      score += 10;
      reasons.push(`May relate to an active experiment`);
    }
  }

  const outlier = item.outlierScore ?? 0;
  if (outlier >= 5) {
    score += 20;
    reasons.push(`Exceptional creator-relative outlier (${outlier.toFixed(1)}×)`);
  } else if (outlier >= 2.5) {
    score += 14;
    reasons.push(`Strong creator-relative outlier (${outlier.toFixed(1)}×)`);
  } else if (outlier >= 1.5) {
    score += 8;
    reasons.push(`Emerging above baseline (${outlier.toFixed(1)}×)`);
  }

  if (item.publishedAt) {
    const ageDays =
      (Date.now() - new Date(item.publishedAt).getTime()) / 86_400_000;
    if (ageDays <= 7) score += 8;
    else if (ageDays <= 30) score += 4;
  }

  const personalFit =
    score >= 45 ? "strong" : score >= 20 ? "medium" : "weak";

  if (reasons.length === 0) {
    reasons.push("Limited personal evidence overlap — external signal only");
  }

  return { score, reasons: reasons.slice(0, 5), personalFit };
}
