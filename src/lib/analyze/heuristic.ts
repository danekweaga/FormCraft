import type { AnalysisResult } from "./schema";

const OPEN_LOOP_PATTERNS =
  /\b(but|however|wait|what if|you won't believe|here's why|the problem is|secret|mistake)\b/i;
const CLAIM_PATTERNS =
  /\b(i|we|you|this|that)\b.*\b(will|can|should|always|never|best|worst|only|proven|guarantee)\b/i;
const PSYCHOLOGY_PATTERNS: Array<{ technique: string; pattern: RegExp }> = [
  { technique: "Curiosity gap", pattern: /\b(how|why|what|secret|nobody|most people)\b/i },
  { technique: "Social proof", pattern: /\b(everyone|millions|thousands|studies|research)\b/i },
  { technique: "Loss aversion", pattern: /\b(miss|lose|mistake|fail|avoid|don't)\b/i },
  { technique: "Authority", pattern: /\b(expert|years|experience|learned|discovered)\b/i },
];

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function classifyHook(sentence: string): { type: string; effectiveness: "strong" | "moderate" | "weak" } {
  if (sentence.length < 20) return { type: "Short opener", effectiveness: "weak" };
  if (OPEN_LOOP_PATTERNS.test(sentence)) {
    return { type: "Curiosity / tension", effectiveness: "strong" };
  }
  if (/^(stop|don't|never|here's|this is)/i.test(sentence)) {
    return { type: "Pattern interrupt", effectiveness: "strong" };
  }
  if (/\?/.test(sentence)) {
    return { type: "Question hook", effectiveness: "moderate" };
  }
  return { type: "Statement hook", effectiveness: "moderate" };
}

function scoreFromRatio(value: number, good: number, ok: number): number {
  if (value >= good) return 8;
  if (value >= ok) return 6;
  if (value >= ok * 0.5) return 4;
  return 3;
}

export function analyzeTranscriptHeuristic(
  transcript: string,
  mode: "quick" | "deep" | "expert",
): AnalysisResult {
  const paragraphs = splitParagraphs(transcript);
  const sentences = splitSentences(transcript);
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;

  const timeline = paragraphs.slice(0, mode === "quick" ? 4 : 8).map((segment, index) => ({
    startLabel: `Section ${index + 1}`,
    segment: segment.slice(0, 120) + (segment.length > 120 ? "…" : ""),
    purpose:
      index === 0
        ? "Opening / hook territory"
        : index === paragraphs.length - 1
          ? "Close / payoff"
          : "Development / proof",
    notes: `~${segment.split(/\s+/).length} words in this segment`,
  }));

  const hookCandidates = sentences.slice(0, 3);
  const hooks = hookCandidates.map((text) => {
    const classified = classifyHook(text);
    return { text, ...classified };
  });

  const openLoops = sentences
    .filter((s) => OPEN_LOOP_PATTERNS.test(s) || /\?$/.test(s))
    .slice(0, mode === "quick" ? 3 : 6)
    .map((text) => ({
      text,
      resolved: paragraphs.indexOf(text) < paragraphs.length - 1,
      notes: "Detected from phrasing — resolution inferred from transcript order only",
    }));

  const psychology = PSYCHOLOGY_PATTERNS.flatMap(({ technique, pattern }) => {
    const match = sentences.find((s) => pattern.test(s));
    return match ? [{ technique, example: match.slice(0, 160), notes: "Keyword heuristic match" }] : [];
  }).slice(0, mode === "quick" ? 2 : 5);

  const retentionDevices = [
    {
      device: "Sequential paragraph pacing",
      location: "Throughout transcript",
      notes: `${paragraphs.length} paragraph breaks detected`,
    },
    ...(sentences.some((s) => /\?/.test(s))
      ? [
          {
            device: "Rhetorical questions",
            location: "Mid-script",
            notes: "Questions can re-engage attention between beats",
          },
        ]
      : []),
  ];

  const potentialRetentionRisks: AnalysisResult["potentialRetentionRisks"] = [];
  if (wordCount > 800 && paragraphs.length < 4) {
    potentialRetentionRisks.push({
      risk: "Long dense blocks without structural breaks",
      severity: "medium",
      suggestion: "Add paragraph breaks or signpost transitions",
    });
  }
  if (sentences[0] && sentences[0].length > 200) {
    potentialRetentionRisks.push({
      risk: "Opening sentence may be too long for short-form retention",
      severity: "high",
      suggestion: "Shorten the first line or split into two beats",
    });
  }
  if (openLoops.length === 0) {
    potentialRetentionRisks.push({
      risk: "Few explicit open loops detected in transcript text",
      severity: "low",
      suggestion: "Consider adding a curiosity gap early",
    });
  }

  const claims = sentences
    .filter((s) => CLAIM_PATTERNS.test(s))
    .slice(0, mode === "quick" ? 3 : 6)
    .map((claim) => ({
      claim,
      supported: /\b(because|for example|when i|data|study|result)\b/i.test(claim),
      notes: "Support inferred from nearby proof language only — no fact checking",
    }));

  const strengths: string[] = [];
  if (hooks.some((h) => h.effectiveness === "strong")) {
    strengths.push("Opening contains tension or pattern-interrupt language");
  }
  if (paragraphs.length >= 3) {
    strengths.push("Transcript has clear sectional structure");
  }
  if (psychology.length >= 2) {
    strengths.push("Multiple persuasion patterns appear in the script");
  }
  if (strengths.length === 0) {
    strengths.push("Transcript provides enough text for baseline structural review");
  }

  const improvements: AnalysisResult["improvements"] = [];
  if (hooks[0]?.effectiveness === "weak") {
    improvements.push({
      area: "Hook",
      suggestion: "Sharpen the first sentence with a specific outcome or tension",
      priority: "high",
    });
  }
  if (openLoops.length < 2) {
    improvements.push({
      area: "Open loops",
      suggestion: "Plant an unanswered question in the first 10 seconds",
      priority: "medium",
    });
  }
  if (wordCount > 600) {
    improvements.push({
      area: "Pacing",
      suggestion: "Audit for filler setup before the first payoff",
      priority: "medium",
    });
  }

  const improvedHooks = hookCandidates.map((hook) => {
    if (hook.length > 100) return hook.slice(0, 80) + "… — [trim setup, lead with payoff]";
    if (!OPEN_LOOP_PATTERNS.test(hook)) {
      return `Here's what most people miss: ${hook.charAt(0).toLowerCase()}${hook.slice(1)}`;
    }
    return hook;
  });

  const recommendedStructure =
    paragraphs.length >= 3
      ? "Hook → context → proof/example → takeaway → CTA. Your transcript already maps roughly to this; tighten transitions between sections."
      : "Hook (1–2 sentences) → single proof beat → clear CTA. Consider splitting dense paragraphs into distinct beats.";

  const avgSentenceLength =
    sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) /
    Math.max(sentences.length, 1);

  const scorecard: AnalysisResult["scorecard"] = [
    {
      category: "Hook strength",
      score: hooks[0]
        ? hooks[0].effectiveness === "strong"
          ? 8
          : hooks[0].effectiveness === "moderate"
            ? 6
            : 4
        : 3,
      rationale: "Based on opening sentence patterns and length",
    },
    {
      category: "Structure clarity",
      score: scoreFromRatio(paragraphs.length, 5, 3),
      rationale: `${paragraphs.length} paragraphs detected`,
    },
    {
      category: "Open loops",
      score: scoreFromRatio(openLoops.length, 4, 2),
      rationale: `${openLoops.length} candidate loops in text`,
    },
    {
      category: "Sentence pacing",
      score: scoreFromRatio(20 - Math.abs(avgSentenceLength - 16), 8, 5),
      rationale: `Average ~${avgSentenceLength.toFixed(0)} words per sentence`,
    },
  ];

  if (mode === "expert" || mode === "deep") {
    scorecard.push({
      category: "Persuasion patterns",
      score: scoreFromRatio(psychology.length, 4, 2),
      rationale: `${psychology.length} psychology patterns matched`,
    });
  }

  const confidenceNotes = [
    "Heuristic transcript-only analysis. Visual and editing analysis unavailable.",
    "LLM deep critique deferred — scores reflect text structure, not performance data.",
    "No visual evidence was available for this analysis.",
  ];

  if (mode === "quick") {
    confidenceNotes.push("Quick mode: fewer sections populated for faster review.");
  }

  return {
    overview: `Transcript contains ~${wordCount} words across ${paragraphs.length} paragraphs and ${sentences.length} sentences. This is a rule-based read of the script structure — not a performance or visual review.`,
    timeline,
    hooks,
    openLoops,
    psychology,
    retentionDevices,
    potentialRetentionRisks,
    claims,
    strengths,
    improvements,
    improvedHooks,
    recommendedStructure,
    scorecard,
    confidenceNotes,
  };
}
