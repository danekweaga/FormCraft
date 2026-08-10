import type { AnalysisResult } from "./schema";
import { scoreToRating } from "./schema";

const OPEN_LOOP_PATTERNS =
  /\b(but|however|wait|what if|you won't believe|here's why|the problem is|secret|mistake)\b/i;
const CLAIM_PATTERNS =
  /\b(i|we|you|this|that)\b.*\b(will|can|should|always|never|best|worst|only|proven|guarantee)\b/i;
const REHOOK_PATTERNS =
  /\b(but (that's|here'|wait)|here's where|the crazy part|not the worst|plot twist|here's the thing)\b/i;
const PSYCHOLOGY_PATTERNS: Array<{ technique: string; pattern: RegExp }> = [
  { technique: "Curiosity gap", pattern: /\b(how|why|what|secret|nobody|most people)\b/i },
  { technique: "Social proof", pattern: /\b(everyone|millions|thousands|studies|research)\b/i },
  { technique: "Loss aversion", pattern: /\b(miss|lose|mistake|fail|avoid|don't)\b/i },
  { technique: "Authority", pattern: /\b(expert|years|experience|learned|discovered)\b/i },
  { technique: "Identity", pattern: /\b(students?|developers?|founders?|creators?|beginners?)\b/i },
];

export type TimedSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

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

function classifyHook(sentence: string): {
  type: string;
  effectiveness: "strong" | "moderate" | "weak";
  mechanisms: string[];
} {
  const mechanisms: string[] = [];
  if (/\?/.test(sentence)) mechanisms.push("Question");
  if (OPEN_LOOP_PATTERNS.test(sentence)) mechanisms.push("Curiosity");
  if (/^(stop|don't|never|here's|this is)/i.test(sentence)) {
    mechanisms.push("Pattern interrupt");
  }
  if (/\b(you|students?|developers?)\b/i.test(sentence)) mechanisms.push("Identity");
  if (/\b(don't|never|waste|enough)\b/i.test(sentence)) mechanisms.push("Contrarian");

  if (sentence.length < 20) {
    return { type: "Short opener", effectiveness: "weak", mechanisms };
  }
  if (mechanisms.includes("Curiosity")) {
    return { type: "Curiosity / tension", effectiveness: "strong", mechanisms };
  }
  if (mechanisms.includes("Pattern interrupt")) {
    return { type: "Pattern interrupt", effectiveness: "strong", mechanisms };
  }
  if (mechanisms.includes("Question")) {
    return { type: "Question hook", effectiveness: "moderate", mechanisms };
  }
  return {
    type: "Statement hook",
    effectiveness: "moderate",
    mechanisms: mechanisms.length ? mechanisms : ["Statement"],
  };
}

function scoreFromRatio(value: number, good: number, ok: number): number {
  if (value >= good) return 8;
  if (value >= ok) return 6;
  if (value >= ok * 0.5) return 4;
  return 3;
}

function estimateSegments(
  transcript: string,
  timed?: TimedSegment[],
): TimedSegment[] {
  if (timed && timed.length > 0) return timed;
  const paragraphs = splitParagraphs(transcript);
  const words = transcript.split(/\s+/).filter(Boolean).length;
  const approxDuration = Math.max(30, Math.round(words / 2.5));
  if (paragraphs.length === 0) {
    return [{ startSeconds: 0, endSeconds: approxDuration, text: transcript }];
  }
  let cursor = 0;
  return paragraphs.map((text, index) => {
    const share = text.split(/\s+/).length / Math.max(words, 1);
    const dur = Math.max(3, Math.round(approxDuration * share));
    const startSeconds = cursor;
    const endSeconds =
      index === paragraphs.length - 1
        ? Math.max(cursor + dur, approxDuration)
        : cursor + dur;
    cursor = endSeconds;
    return { startSeconds, endSeconds, text };
  });
}

function sectionType(index: number, total: number, text: string): string {
  if (index === 0) return "Hook";
  if (index === total - 1) {
    if (/\b(follow|subscribe|comment|like|save|link)\b/i.test(text)) return "CTA";
    return "Payoff";
  }
  if (REHOOK_PATTERNS.test(text)) return "Rehook";
  if (/\b(for example|when i|proof|data|number)\b/i.test(text)) return "Proof";
  if (index === 1) return "Setup";
  return "Body";
}

export function analyzeTranscriptHeuristic(
  transcript: string,
  mode: "quick" | "deep" | "expert",
  options?: { timedSegments?: TimedSegment[]; hasVisualEvidence?: boolean },
): AnalysisResult {
  const paragraphs = splitParagraphs(transcript);
  const sentences = splitSentences(transcript);
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const segments = estimateSegments(transcript, options?.timedSegments);
  const hasVisual = Boolean(options?.hasVisualEvidence);

  const timeline = segments
    .slice(0, mode === "quick" ? 4 : 10)
    .map((segment, index) => {
      const type = sectionType(index, segments.length, segment.text);
      return {
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
        type,
        transcript: segment.text.slice(0, 220),
        purpose:
          type === "Hook"
            ? "Opening / attention"
            : type === "CTA"
              ? "Ask / next step"
              : type === "Payoff"
                ? "Close / resolution"
                : "Development / proof",
        assessment: `~${segment.text.split(/\s+/).length} words in this segment`,
        startLabel: formatClock(segment.startSeconds),
        endLabel: formatClock(segment.endSeconds),
        segment: segment.text.slice(0, 120),
        notes: `Proxy timing from transcript structure${options?.timedSegments ? " + ASR segments" : ""}`,
      };
    });

  const hookCandidates = sentences.slice(0, 3);
  const hooks = hookCandidates.map((text, index) => {
    const classified = classifyHook(text);
    return {
      timestamp: index === 0 ? 0 : Math.min(index * 4, segments[0]?.endSeconds ?? 8),
      text,
      type: classified.type,
      mechanisms: classified.mechanisms,
      explanation: `Detected from opening phrasing (${classified.mechanisms.join(", ") || "statement"}).`,
      assessment: classified.effectiveness,
      improvements:
        classified.effectiveness === "weak"
          ? ["Sharpen the first line with a specific outcome or tension."]
          : [],
      effectiveness: classified.effectiveness,
      notes: "Heuristic classification from transcript text only",
    };
  });

  const primaryHook = hooks[0];
  const hookStack = {
    primary: primaryHook?.type ?? null,
    mechanisms: Array.from(new Set(hooks.flatMap((h) => h.mechanisms))),
    assessment:
      (primaryHook?.mechanisms.length ?? 0) >= 2
        ? "Multiple attention mechanisms appear in the opening — stacking may reinforce or dilute depending on clarity."
        : "Opening relies on a single primary mechanism.",
  };

  const rehooks = sentences
    .map((text, index) => ({ text, index }))
    .filter(({ text, index }) => index > 0 && REHOOK_PATTERNS.test(text))
    .slice(0, mode === "quick" ? 2 : 5)
    .map(({ text, index }) => ({
      timestamp: Math.min(index * 5, timeline.at(-1)?.endSeconds ?? index * 5),
      text,
      type: "Verbal rehook",
      purpose: "Renew attention / reopen tension",
      assessment: "May re-engage if the prior section was dense or explanatory.",
    }));

  const openLoops = sentences
    .filter((s) => OPEN_LOOP_PATTERNS.test(s) || /\?$/.test(s))
    .slice(0, mode === "quick" ? 3 : 6)
    .map((text, index) => ({
      createdAt: Math.min(index * 8, timeline.at(-1)?.endSeconds ?? index * 8),
      resolvedAt: null as number | null,
      questionCreated: text,
      assessment:
        "Loop detected from phrasing — resolution inferred only if later text answers it.",
      text,
      resolved: index < sentences.length - 1,
      notes: "Detected from phrasing — resolution inferred from transcript order only",
    }));

  const psychology = PSYCHOLOGY_PATTERNS.flatMap(({ technique, pattern }) => {
    const matchIndex = sentences.findIndex((s) => pattern.test(s));
    if (matchIndex < 0) return [];
    const match = sentences[matchIndex]!;
    return [
      {
        mechanism: technique,
        evidence: match.slice(0, 160),
        timestamp: Math.min(matchIndex * 5, timeline.at(-1)?.endSeconds ?? matchIndex * 5),
        interpretation: `This may create ${technique.toLowerCase()} for viewers who recognize the cue — hypothesis only.`,
        technique,
        example: match.slice(0, 160),
        notes: "Keyword heuristic match",
      },
    ];
  }).slice(0, mode === "quick" ? 2 : 5);

  const retentionDevices = [
    {
      timestamp: 0,
      type: "Sequential paragraph pacing",
      explanation: `${paragraphs.length} paragraph breaks detected`,
      device: "Sequential paragraph pacing",
      location: "Throughout transcript",
      notes: `${paragraphs.length} paragraph breaks detected`,
    },
    ...rehooks.slice(0, 2).map((r) => ({
      timestamp: r.timestamp,
      type: "Rehook",
      explanation: r.text.slice(0, 120),
      device: "Rehook",
      location: formatClock(r.timestamp),
      notes: r.purpose,
    })),
  ];

  const retentionRisks: AnalysisResult["retentionRisks"] = [];
  if (wordCount > 800 && paragraphs.length < 4) {
    retentionRisks.push({
      startSeconds: timeline[1]?.startSeconds ?? 10,
      endSeconds: timeline[2]?.endSeconds ?? 30,
      reason: "Long dense blocks without structural breaks",
      recommendation: "Add paragraph breaks or signpost transitions",
      risk: "Long dense blocks without structural breaks",
      severity: "medium",
      suggestion: "Add paragraph breaks or signpost transitions",
    });
  }
  if (sentences[0] && sentences[0].length > 200) {
    retentionRisks.push({
      startSeconds: 0,
      endSeconds: timeline[0]?.endSeconds ?? 8,
      reason: "Opening sentence may be too long for short-form retention",
      recommendation: "Shorten the first line or split into two beats",
      risk: "Opening sentence may be too long for short-form retention",
      severity: "high",
      suggestion: "Shorten the first line or split into two beats",
    });
  }
  if (openLoops.length === 0) {
    retentionRisks.push({
      startSeconds: 0,
      endSeconds: timeline[0]?.endSeconds ?? 10,
      reason: "Few explicit open loops detected in transcript text",
      recommendation: "Consider adding a curiosity gap early",
      risk: "Few explicit open loops detected in transcript text",
      severity: "low",
      suggestion: "Consider adding a curiosity gap early",
    });
  }

  const claims = sentences
    .filter((s) => CLAIM_PATTERNS.test(s))
    .slice(0, mode === "quick" ? 3 : 6)
    .map((claim) => {
      const supported = /\b(because|for example|when i|data|study|result)\b/i.test(
        claim,
      );
      return {
        claim,
        claimType: supported ? "personal_or_supported" : "opinion_or_assertion",
        evidenceProvided: supported
          ? ["Nearby proof language in transcript"]
          : [],
        assessment: supported
          ? "Some in-transcript support language nearby"
          : "Limited in-content evidence for this claim",
        supported,
        notes: "Support inferred from nearby proof language only — no fact checking",
      };
    });

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
  if (rehooks.length > 0) {
    strengths.push("At least one verbal rehook candidate was detected");
  }
  if (strengths.length === 0) {
    strengths.push("Transcript provides enough text for baseline structural review");
  }

  const improvements: AnalysisResult["improvements"] = [];
  if (hooks[0]?.effectiveness === "weak") {
    improvements.push({
      priority: "high",
      timestamp: 0,
      issue: "Weak opening hook",
      whyItMatters: "Early attention often decides whether the rest is heard.",
      recommendation: "Sharpen the first sentence with a specific outcome or tension",
      example: null,
      area: "Hook",
      suggestion: "Sharpen the first sentence with a specific outcome or tension",
    });
  }
  if (openLoops.length < 2) {
    improvements.push({
      priority: "medium",
      timestamp: 0,
      issue: "Few open loops",
      whyItMatters: "Without unanswered questions, the middle can feel flat.",
      recommendation: "Plant an unanswered question in the first 10 seconds",
      example: null,
      area: "Open loops",
      suggestion: "Plant an unanswered question in the first 10 seconds",
    });
  }
  if (wordCount > 600) {
    improvements.push({
      priority: "medium",
      timestamp: timeline[1]?.startSeconds ?? null,
      issue: "Possible pacing drag",
      whyItMatters: "Long scripts often hide filler before the first payoff.",
      recommendation: "Audit for filler setup before the first payoff",
      example: null,
      area: "Pacing",
      suggestion: "Audit for filler setup before the first payoff",
    });
  }

  const improvedHooks = hookCandidates.map((hook) => {
    if (hook.length > 100) {
      return `${hook.slice(0, 80)}… — [trim setup, lead with payoff]`;
    }
    if (!OPEN_LOOP_PATTERNS.test(hook)) {
      return `Here's what most people miss: ${hook.charAt(0).toLowerCase()}${hook.slice(1)}`;
    }
    return hook;
  });

  const recommendedStructure =
    paragraphs.length >= 3
      ? "Hook → context → proof/example → takeaway → CTA. Your transcript already maps roughly to this; tighten transitions between sections."
      : "Hook (1–2 sentences) → single proof beat → clear CTA. Consider splitting dense paragraphs into distinct beats.";

  const improvedStructure = [
    { section: "Hook", purpose: "Open with tension / specific claim", suggestedDuration: "0–3s" },
    { section: "Proof or personal stake", purpose: "Earn attention quickly", suggestedDuration: "3–10s" },
    { section: "Explanation", purpose: "Deliver mechanism / insight", suggestedDuration: "mid" },
    { section: "Payoff + CTA", purpose: "Resolve promise, ask for next step", suggestedDuration: "close" },
  ];

  const avgSentenceLength =
    sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) /
    Math.max(sentences.length, 1);

  const numericScorecard = [
    {
      category: "Hook",
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
      category: "Structure",
      score: scoreFromRatio(paragraphs.length, 5, 3),
      rationale: `${paragraphs.length} paragraphs detected`,
    },
    {
      category: "Rehooks",
      score: scoreFromRatio(rehooks.length, 3, 1),
      rationale: `${rehooks.length} rehook candidates`,
    },
    {
      category: "Open loops",
      score: scoreFromRatio(openLoops.length, 4, 2),
      rationale: `${openLoops.length} candidate loops in text`,
    },
    {
      category: "Specificity",
      score: scoreFromRatio(20 - Math.abs(avgSentenceLength - 16), 8, 5),
      rationale: `Average ~${avgSentenceLength.toFixed(0)} words per sentence`,
    },
    {
      category: "Viewer psychology",
      score: scoreFromRatio(psychology.length, 4, 2),
      rationale: `${psychology.length} psychology patterns matched`,
    },
    {
      category: "Visual communication",
      score: hasVisual ? 5 : 0,
      rationale: hasVisual
        ? "Frames available — still needs multimodal review"
        : "No visual evidence",
    },
    {
      category: "Editing",
      score: hasVisual ? 5 : 0,
      rationale: hasVisual
        ? "Frames available — still needs multimodal review"
        : "No editing evidence without media",
    },
  ];

  const scorecard = numericScorecard.map((s) => ({
    category: s.category,
    rating: hasVisual || !["Visual communication", "Editing"].includes(s.category)
      ? scoreToRating(s.score || 1)
      : ("Unable to Evaluate" as const),
    explanation: s.rationale,
    score: s.score,
    rationale: s.rationale,
  }));

  const confidenceNotes = [
    "Heuristic transcript analysis. Visual and editing analysis unavailable unless frames were provided.",
    "Scores reflect text structure, not proven retention or causation.",
    hasVisual
      ? "Visual evidence flag is set — multimodal stage may enrich observations."
      : "No visual evidence was available for this analysis.",
  ];
  if (mode === "quick") {
    confidenceNotes.push("Quick mode: fewer sections populated for faster review.");
  }

  return {
    overview: {
      topic: sentences[0]?.slice(0, 80) || "Transcript analysis",
      intendedAudience: psychology.some((p) => p.mechanism === "Identity")
        ? "Identity cues detected in transcript"
        : null,
      coreMessage: `Transcript contains ~${wordCount} words across ${paragraphs.length} paragraphs.`,
      contentGoal: null,
    },
    timeline,
    hooks,
    rehooks,
    openLoops,
    psychology,
    retentionDevices,
    retentionRisks,
    potentialRetentionRisks: retentionRisks,
    claims,
    strengths,
    improvements,
    improvedHooks,
    improvedStructure,
    recommendedStructure,
    scorecard,
    sourcesUsed: [],
    confidenceNotes,
    visualObservations: [],
    editingMap: [],
    observedRetention: [],
    hookStack,
    rewrittenScript: null,
  };
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}
