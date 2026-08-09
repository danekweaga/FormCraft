export type IdeaRecommendation = "pursue" | "reshape" | "park" | "kill";

export type IdeaGateHeuristic = {
  recommendation: IdeaRecommendation;
  why: string;
  evidence: string[];
  risks: string[];
  missingIngredient: string | null;
  betterAngle: string | null;
  bestFormat: string | null;
  confidenceNote: string;
};

const VAGUE = [
  "tips",
  "hacks",
  "things",
  "stuff",
  "amazing",
  "best",
  "secret",
  "viral",
];

export function evaluateIdeaHeuristic(ideaText: string): IdeaGateHeuristic {
  const text = ideaText.trim();
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const vagueHits = VAGUE.filter((word) => lower.includes(word));
  const hasSpecificAudience =
    /\b(for|who|students|founders|devs|creators|parents)\b/i.test(text);
  const hasOutcome = /\b(so that|to get|into|from|without|how to)\b/i.test(text);
  const tooShort = words.length < 8;

  let recommendation: IdeaRecommendation = "pursue";
  const evidence: string[] = [];
  const risks: string[] = [];
  let missingIngredient: string | null = null;
  let betterAngle: string | null = null;

  if (tooShort) {
    recommendation = "reshape";
    risks.push("Idea is too short to evaluate specificity.");
    missingIngredient = "A concrete audience + outcome.";
  }
  if (vagueHits.length >= 2) {
    recommendation = "reshape";
    evidence.push(`Vague language detected: ${vagueHits.join(", ")}.`);
    betterAngle = "Replace vague claims with a specific tension or result.";
  }
  if (!hasSpecificAudience) {
    risks.push("No clear audience signal.");
    missingIngredient = missingIngredient ?? "Named audience.";
    if (recommendation === "pursue") recommendation = "reshape";
  } else {
    evidence.push("Mentions or implies an audience.");
  }
  if (hasOutcome) {
    evidence.push("Contains an outcome or transformation cue.");
  } else if (recommendation === "pursue") {
    recommendation = "park";
    risks.push("Outcome is unclear — park until the payoff is sharp.");
  }
  if (words.length > 80) {
    recommendation = "reshape";
    risks.push("Idea reads like a script, not a gateable concept.");
  }
  if (words.length < 4 && vagueHits.length > 0) {
    recommendation = "kill";
    risks.push("No actionable concept beyond generic clickbait language.");
  }

  const whyByRec: Record<IdeaRecommendation, string> = {
    pursue: "Heuristic pass: enough audience and outcome signal to test.",
    park: "Heuristic park: promising fragments, but not sharp enough to produce yet.",
    kill: "Heuristic kill: no actionable signal.",
    reshape:
      "Heuristic reshape: tighten audience, tension, or outcome before drafting.",
  };
  const why = whyByRec[recommendation];

  return {
    recommendation,
    why,
    evidence,
    risks,
    missingIngredient,
    betterAngle,
    bestFormat: words.length < 25 ? "short_video" : "carousel_or_talking_head",
    confidenceNote:
      "Heuristic Idea Gate only. Full AI evaluation against Knowledge, My Content lessons, and Audience language is deferred — no LLM provider called.",
  };
}

export type PrePublishHeuristicResult = {
  mode: "heuristic_stub";
  summary: string;
  checks: Array<{ id: string; pass: boolean; note: string }>;
  confidenceNote: string;
};

export function reviewScriptHeuristic(inputText: string): PrePublishHeuristicResult {
  const text = inputText.trim();
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const firstLine = lines[0] ?? "";
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasCta = /\b(follow|comment|save|share|link|subscribe|dm|try)\b/i.test(
    text,
  );
  const hasHookSignal =
    firstLine.length > 0 &&
    (firstLine.length <= 120 || /[?!]/.test(firstLine) || /^\d/.test(firstLine));

  const checks = [
    {
      id: "opening_hook",
      pass: hasHookSignal,
      note: hasHookSignal
        ? "Opening line has a hook-like shape."
        : "Opening line is long or flat — sharpen the first beat.",
    },
    {
      id: "length",
      pass: wordCount >= 40 && wordCount <= 450,
      note:
        wordCount < 40
          ? "Very short for a full script."
          : wordCount > 450
            ? "Long for short-form — consider a cut plan (Editing Copilot deferred)."
            : "Length looks reasonable for short-form.",
    },
    {
      id: "cta",
      pass: hasCta,
      note: hasCta
        ? "Contains a soft CTA keyword."
        : "No CTA keyword detected — optional depending on goal.",
    },
  ];

  const passed = checks.filter((check) => check.pass).length;

  return {
    mode: "heuristic_stub",
    summary: `${passed}/${checks.length} heuristic checks passed.`,
    checks,
    confidenceNote:
      "Stub Pre-Publish review. LLM stress-test against Teach FormCraft rules and confirmed lessons is deferred — no provider called.",
  };
}

export function splitCommentPaste(raw: string): string[] {
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 200);
}
