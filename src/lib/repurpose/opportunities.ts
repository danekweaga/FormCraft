export type RepurposeSource = {
  id: string;
  title: string | null;
  caption: string | null;
  hookText?: string | null;
  format?: string | null;
  topic?: string | null;
  views: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  isWinner: boolean;
  needsReview: boolean;
  relativePerformance?: Record<string, unknown> | null;
};

export type RepurposeRecommendation = {
  opportunityType: "remake" | "follow_up" | "comment_response" | "carousel" | "social_post" | "not_worth";
  title: string;
  reason: string;
  evidence: string[];
  recommendation: {
    keep: string[];
    change: string[];
    sourceTitle: string;
  };
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function relativeMultiple(source: RepurposeSource): number | null {
  const relative = source.relativePerformance ?? {};
  for (const key of ["views", "view_ratio", "views_ratio", "relative_views", "score"]) {
    const raw = relative[key];
    if (typeof raw === "object" && raw !== null) {
      const nested = raw as Record<string, unknown>;
      const value = finiteNumber(nested.ratio ?? nested.multiple ?? nested.value);
      if (value !== null) return value;
    }
    const value = finiteNumber(raw);
    if (value !== null) return value;
  }
  return null;
}

function sourceTitle(source: RepurposeSource): string {
  return (
    source.title?.trim() ||
    source.hookText?.trim() ||
    source.caption?.trim().slice(0, 90) ||
    "Untitled post"
  );
}

export function evaluateRepurposing(source: RepurposeSource): RepurposeRecommendation[] {
  const title = sourceTitle(source);
  const multiple = relativeMultiple(source);
  const strongSignal = source.isWinner || (multiple !== null && multiple >= 1.25);
  const evidence: string[] = [];

  if (source.views !== null) evidence.push(`${source.views.toLocaleString()} views`);
  if (multiple !== null) evidence.push(`${multiple.toFixed(2)}x your comparable-post baseline`);
  if (source.isWinner) evidence.push("Flagged as a winner by FormCraft's baseline rules");
  if ((source.comments ?? 0) > 0) evidence.push(`${source.comments} comments available for follow-up signals`);

  if (!strongSignal) {
    return [
      {
        opportunityType: "not_worth",
        title: `Do not repurpose yet: ${title}`,
        reason:
          multiple === null
            ? "There is not enough comparable performance evidence to justify multiplying this post yet."
            : "This post has not cleared the evidence threshold for a remake or derivative.",
        evidence: evidence.length ? evidence : ["No reliable performance baseline is available"],
        recommendation: {
          keep: [],
          change: ["Collect more performance data or test a stronger source post first"],
          sourceTitle: title,
        },
      },
    ];
  }

  const keep = [
    source.hookText ? `Hook premise: ${source.hookText}` : "The core promise that earned attention",
    source.topic ? `Topic: ${source.topic}` : "The proven topic",
  ];
  const results: RepurposeRecommendation[] = [
    {
      opportunityType: "remake",
      title: `Remake the proven premise: ${title}`,
      reason: "The source beat your normal performance, so preserve the promise while testing a new execution.",
      evidence,
      recommendation: {
        keep,
        change: ["Opening visual or first sentence", "Example, proof, or story", "Packaging and call to action"],
        sourceTitle: title,
      },
    },
    {
      opportunityType: "follow_up",
      title: `Build a follow-up to: ${title}`,
      reason: "A proven topic can support a deeper, narrower, or objection-led sequel without copying the original.",
      evidence,
      recommendation: {
        keep,
        change: ["Answer the next question the original creates", "Lead with a new tension or objection"],
        sourceTitle: title,
      },
    },
    {
      opportunityType: "social_post",
      title: `Condense the lesson from: ${title}`,
      reason: "The source premise has personal performance evidence and can be tested as a concise text-led post without claiming the format will perform identically.",
      evidence,
      recommendation: {
        keep,
        change: ["Lead with one claim", "Turn the proof into a compact example", "End with a discussion prompt"],
        sourceTitle: title,
      },
    },
  ];

  if ((source.comments ?? 0) > 0) {
    results.push({
      opportunityType: "comment_response",
      title: `Mine the comments for a response video`,
      reason: "The source has audience replies that may contain a question, objection, or misunderstanding worth answering.",
      evidence,
      recommendation: {
        keep,
        change: ["Choose one real comment before scripting", "Show the comment as evidence", "Answer only what the commenter actually asked"],
        sourceTitle: title,
      },
    });
  }

  if ((source.saves ?? 0) > 0 || (source.shares ?? 0) > 0) {
    results.push({
      opportunityType: "carousel",
      title: `Turn the useful core into a swipeable breakdown`,
      reason: "Save or share activity is evidence that the idea may work as a reference-style asset.",
      evidence,
      recommendation: {
        keep,
        change: ["Split the logic into one claim per slide", "Add a final summary/checklist"],
        sourceTitle: title,
      },
    });
  }

  return results;
}
