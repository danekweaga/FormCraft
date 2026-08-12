import type { AnalysisResult } from "./schema";

type TimedSentence = {
  text: string;
  startSeconds: number;
  endSeconds: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "but",
  "by",
  "for",
  "from",
  "i",
  "if",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "this",
  "to",
  "was",
  "we",
  "what",
  "when",
  "with",
  "you",
  "your",
]);

const REVERSAL = /\b(but|however|except|the weird part|here(?:'|’)s the problem|plot twist|instead)\b/i;
const PROMISE = /\b(here(?:'|’)s what happened|wait until|the reason is|here(?:'|’)s why|i(?:'|’)ll show you|by the end)\b/i;
const PROOF = /\b(for example|for instance|because|the data|the result|i tested|when i|screenshot|demo|proof|before and after|from\s+\d+\s+to\s+\d+)\b/i;
const CLAIM = /\b(should|will|always|never|best|worst|only|need to|means that|proves?|causes?)\b/i;
const PAYOFF = /\b(the answer|the lesson|the takeaway|what changed|that(?:'|’)s why|so the point|in other words|which means)\b/i;
const CTA = /\b(follow|subscribe|comment|save this|share this|try this|do this|tell me|let me know)\b/i;
const TENSION = /\b(the problem is|mistake|wrong|nobody|most people|what if|why|how|secret|until)\b/i;

function sentenceParts(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function timedSentences(timeline: AnalysisResult["timeline"]): TimedSentence[] {
  return timeline.flatMap((segment) => {
    const parts = sentenceParts(segment.transcript);
    if (!parts.length) return [];
    const totalCharacters = parts.reduce((sum, part) => sum + part.length, 0);
    let cursor = segment.startSeconds;
    return parts.map((text, index) => {
      const proportional =
        (segment.endSeconds - segment.startSeconds) *
        (text.length / Math.max(1, totalCharacters));
      const endSeconds =
        index === parts.length - 1
          ? segment.endSeconds
          : Math.min(segment.endSeconds, cursor + Math.max(0.25, proportional));
      const sentence = { text, startSeconds: cursor, endSeconds };
      cursor = endSeconds;
      return sentence;
    });
  });
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function overlap(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.max(1, Math.min(a.size, b.size));
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function rehookCandidateScore(
  sentence: TimedSentence,
  previous: TimedSentence | undefined,
): { score: number; type: string; reasons: string[] } {
  let score = 0;
  let type = "semantic_shift";
  const reasons: string[] = [];

  if (REVERSAL.test(sentence.text)) {
    score += 2;
    type = "contradiction";
    reasons.push("explicit reversal");
  }
  if (/\?/.test(sentence.text)) {
    score += 1.5;
    type = "new_question";
    reasons.push("new explicit question");
  }
  if (PROMISE.test(sentence.text)) {
    score += 1.5;
    type = "new_promise";
    reasons.push("future promise");
  }
  if (PROOF.test(sentence.text)) {
    score += 1;
    type = "evidence_or_example";
    reasons.push("new concrete evidence or example");
  }
  if (previous && overlap(previous.text, sentence.text) < 0.18) {
    score += 1;
    reasons.push("semantic topic shift");
  }
  if (/\b(then|suddenly|eventually|after that|until one day)\b/i.test(sentence.text)) {
    score += 1;
    type = "story_state_change";
    reasons.push("story-state change");
  }
  return { score, type, reasons };
}

function findResolution(
  sentences: TimedSentence[],
  openedIndex: number,
): TimedSentence | null {
  const opening = sentences[openedIndex];
  if (!opening) return null;
  for (let index = openedIndex + 1; index < sentences.length; index += 1) {
    const candidate = sentences[index]!;
    const related = overlap(opening.text, candidate.text) >= 0.2;
    const answerCue = /\b(because|the answer|the reason|turns out|what happened|that(?:'|’)s why|it was|the fix|the solution)\b/i.test(
      candidate.text,
    );
    if ((related && (answerCue || index >= openedIndex + 2)) || answerCue) {
      return candidate;
    }
  }
  return null;
}

function textThrough(sentences: TimedSentence[], seconds: number): string | null {
  const value = sentences
    .filter((sentence) => sentence.startSeconds < seconds)
    .map((sentence) => sentence.text)
    .join(" ")
    .trim();
  return value || null;
}

export function buildDeterministicEvidence(params: {
  timeline: AnalysisResult["timeline"];
  hasVisualEvidence: boolean;
}): Pick<
  AnalysisResult,
  | "rehooks"
  | "openLoops"
  | "evidenceFindings"
  | "progressEvents"
  | "hookWindows"
  | "progressDeserts"
  | "claimEvidenceMap"
  | "attentionSupport"
> {
  const sentences = timedSentences(params.timeline);
  const duration = Math.max(1, ...params.timeline.map((item) => item.endSeconds));
  const rehooks: AnalysisResult["rehooks"] = [];
  const progressEvents: AnalysisResult["progressEvents"] = [];

  sentences.forEach((sentence, index) => {
    const evidenceId = `transcript:${index}`;
    if (index === 0) {
      progressEvents.push({
        id: "progress:hook:0",
        timestamp: sentence.startSeconds,
        endSeconds: sentence.endSeconds,
        type: "hook",
        text: sentence.text,
        informationalValue: "high",
        evidenceId,
      });
      return;
    }

    const candidate = rehookCandidateScore(sentence, sentences[index - 1]);
    if (candidate.score >= 2.5) {
      rehooks.push({
        timestamp: sentence.startSeconds,
        text: sentence.text,
        type: candidate.type.replace(/_/g, " "),
        purpose: candidate.reasons.join(" + "),
        assessment:
          "Deterministic candidate: this renews informational motivation rather than merely marking an edit.",
      });
      progressEvents.push({
        id: `progress:rehook:${index}`,
        timestamp: sentence.startSeconds,
        endSeconds: sentence.endSeconds,
        type: "rehook",
        text: sentence.text,
        informationalValue: candidate.score >= 3.5 ? "high" : "medium",
        evidenceId,
      });
      return;
    }

    let type: AnalysisResult["progressEvents"][number]["type"] | null = null;
    if (PROOF.test(sentence.text)) type = "proof";
    else if (/\b(for example|for instance|take a|imagine)\b/i.test(sentence.text)) type = "example";
    else if (/\?/.test(sentence.text)) type = "question";
    else if (REVERSAL.test(sentence.text)) type = "contradiction";
    else if (PAYOFF.test(sentence.text)) type = "payoff";
    else if (CTA.test(sentence.text)) type = "cta";
    else if (CLAIM.test(sentence.text)) type = "claim";

    if (type) {
      progressEvents.push({
        id: `progress:${type}:${index}`,
        timestamp: sentence.startSeconds,
        endSeconds: sentence.endSeconds,
        type,
        text: sentence.text,
        informationalValue: type === "proof" || type === "payoff" ? "high" : "medium",
        evidenceId,
      });
    }
  });

  const loopCandidates = sentences
    .map((sentence, index) => ({ sentence, index }))
    .filter(({ sentence }) => /\?/.test(sentence.text) || TENSION.test(sentence.text))
    .slice(0, 8);
  const openLoops: AnalysisResult["openLoops"] = loopCandidates.map(
    ({ sentence, index }) => {
      const resolution = findResolution(sentences, index);
      return {
        createdAt: sentence.startSeconds,
        resolvedAt: resolution?.startSeconds ?? null,
        questionCreated: sentence.text,
        assessment: resolution
          ? `A related answer or payoff appears at ${formatClock(resolution.startSeconds)}.`
          : "No defensible resolution was found in the transcript; this remains unresolved.",
        text: sentence.text,
        resolved: Boolean(resolution),
        notes: "Detected from timestamped transcript language; review the proposed resolution.",
      };
    },
  );

  const threshold = Math.max(10, duration * 0.18);
  const eventTimes = [
    0,
    ...progressEvents.map((event) => event.timestamp),
    duration,
  ].sort((a, b) => a - b);
  const progressDeserts: AnalysisResult["progressDeserts"] = [];
  for (let index = 1; index < eventTimes.length; index += 1) {
    const startSeconds = eventTimes[index - 1]!;
    const endSeconds = eventTimes[index]!;
    if (endSeconds - startSeconds >= threshold) {
      progressDeserts.push({
        startSeconds,
        endSeconds,
        reason:
          "No new question, claim, example, proof, contradiction, payoff, or CTA was detected in this interval.",
      });
    }
  }

  const claims = sentences
    .map((sentence, index) => ({ sentence, index }))
    .filter(({ sentence }) => CLAIM.test(sentence.text))
    .slice(0, 8);
  const claimEvidenceMap: AnalysisResult["claimEvidenceMap"] = claims.map(
    ({ sentence, index }) => {
      const proof = sentences
        .slice(index + 1)
        .find((candidate) => PROOF.test(candidate.text));
      const latency = proof
        ? Math.max(0, proof.startSeconds - sentence.startSeconds)
        : null;
      return {
        claim: sentence.text,
        claimTimestamp: sentence.startSeconds,
        proofTimestamp: proof?.startSeconds ?? null,
        proofLatencySeconds: latency,
        assessment: proof
          ? `The next transcript proof cue appears ${latency!.toFixed(1)} seconds later.`
          : "No later transcript proof cue was detected. This is not an external fact-check.",
      };
    },
  );

  const openingTenPercent = Math.max(1, duration * 0.1);
  const hookWindows: AnalysisResult["hookWindows"] = [
    {
      window: "first_frame",
      startSeconds: 0,
      endSeconds: 0,
      available: params.hasVisualEvidence,
      excerpt: null,
      question: "Does the first frame orient the intended viewer?",
      assessment: params.hasVisualEvidence
        ? "A visual source exists; inspect the frame evidence rather than inferring it from speech."
        : "Unavailable: no visual evidence was supplied.",
    },
    {
      window: "first_second",
      startSeconds: 0,
      endSeconds: 1,
      available: Boolean(textThrough(sentences, 1)),
      excerpt: textThrough(sentences, 1),
      question: "Is an intelligible claim or stimulus present?",
      assessment: textThrough(sentences, 1)
        ? "Transcript evidence is present in this window."
        : "No timestamped speech is available in this window.",
    },
    {
      window: "first_three_seconds",
      startSeconds: 0,
      endSeconds: 3,
      available: Boolean(textThrough(sentences, 3)),
      excerpt: textThrough(sentences, 3),
      question: "What honest reason to continue has been established?",
      assessment: textThrough(sentences, 3)
        ? "Review the excerpt for audience, promise, stakes, and specificity."
        : "No timestamped speech is available in this window.",
    },
    {
      window: "opening_ten_percent",
      startSeconds: 0,
      endSeconds: openingTenPercent,
      available: Boolean(textThrough(sentences, openingTenPercent)),
      excerpt: textThrough(sentences, openingTenPercent),
      question: "Has the promise become clearer without exhausting the payoff?",
      assessment:
        "This proportional window avoids imposing one universal hook duration on every format.",
    },
  ];

  const evidenceFindings: AnalysisResult["evidenceFindings"] = [];
  progressDeserts.forEach((desert, index) => {
    evidenceFindings.push({
      id: `finding:progress-desert:${index}`,
      evidenceClass: "content_observation",
      title: "Possible progress desert",
      statement: `${formatClock(desert.startSeconds)}–${formatClock(desert.endSeconds)} contains no detected informational progress event.`,
      startSeconds: desert.startSeconds,
      endSeconds: desert.endSeconds,
      evidenceIds: [`timeline:progress-desert:${index}`],
      psychologyPrincipleNames: ["Meaningful segmentation and coherence"],
      confidence: "medium",
      uncertainty:
        "A meaningful visual or audio event could exist if it was not supplied to the analysis.",
      suggestedExperiment:
        "Compress this interval or add one relevant example/proof beat while keeping the rest of the video comparable.",
    });
  });
  openLoops.forEach((loop, index) => {
    if (loop.resolvedAt == null) {
      evidenceFindings.push({
        id: `finding:unresolved-loop:${index}`,
        evidenceClass: "content_observation",
        title: "Unresolved opening question",
        statement: `The question opened at ${formatClock(loop.createdAt)} has no defensible transcript resolution.`,
        startSeconds: loop.createdAt,
        endSeconds: null,
        evidenceIds: [`transcript:loop:${index}`],
        psychologyPrincipleNames: ["Relevant information gap"],
        confidence: "medium",
        uncertainty: "The resolution may be visual or implicit rather than spoken.",
        suggestedExperiment:
          "Record a version with an explicit payoff and compare completion or saves with a similar post.",
      });
    } else if (loop.resolvedAt - loop.createdAt <= Math.max(3, duration * 0.06)) {
      evidenceFindings.push({
        id: `finding:answer-leakage:${index}`,
        evidenceClass: "psychological_hypothesis",
        title: "Possible answer leakage",
        statement: `The question at ${formatClock(loop.createdAt)} appears to resolve by ${formatClock(loop.resolvedAt)}.`,
        startSeconds: loop.createdAt,
        endSeconds: loop.resolvedAt,
        evidenceIds: [`transcript:loop:${index}`],
        psychologyPrincipleNames: ["Relevant information gap"],
        confidence: "low",
        uncertainty:
          "Fast resolution may be correct for clarity; there is no universal optimal loop duration.",
        suggestedExperiment:
          "Test a version that establishes proof or stakes before the full answer, without withholding essential context.",
      });
    }
  });
  claimEvidenceMap.forEach((item, index) => {
    if (item.proofTimestamp == null) {
      evidenceFindings.push({
        id: `finding:unsupported-claim:${index}`,
        evidenceClass: "content_observation",
        title: "Claim without a nearby proof cue",
        statement: item.claim,
        startSeconds: item.claimTimestamp,
        endSeconds: null,
        evidenceIds: [`transcript:claim:${index}`],
        psychologyPrincipleNames: [],
        confidence: "medium",
        uncertainty:
          "The claim may be opinion, common knowledge, or supported visually; this is not a fact-check.",
        suggestedExperiment: null,
      });
    }
  });

  const attentionSupport: AnalysisResult["attentionSupport"] = [
    {
      dimension: "hook_relevance",
      status: sentences[0] && (TENSION.test(sentences[0].text) || /\?/.test(sentences[0].text))
        ? "supportive"
        : "mixed",
      evidence: sentences[0]?.text ?? "No opening transcript evidence.",
    },
    {
      dimension: "semantic_progress",
      status: progressDeserts.length ? "risk" : "supportive",
      evidence: progressDeserts.length
        ? `${progressDeserts.length} interval(s) lack a detected progress event.`
        : `${progressEvents.length} progress events were detected across the timeline.`,
    },
    {
      dimension: "proof_alignment",
      status: claimEvidenceMap.some((item) => item.proofTimestamp == null)
        ? "mixed"
        : claimEvidenceMap.length
          ? "supportive"
          : "unavailable",
      evidence: claimEvidenceMap.length
        ? `${claimEvidenceMap.filter((item) => item.proofTimestamp != null).length}/${claimEvidenceMap.length} claim(s) have a later transcript proof cue.`
        : "No claim/proof pairs were detected.",
    },
    {
      dimension: "coherence",
      status: "mixed",
      evidence:
        "Transcript structure can be assessed, but competing captions, B-roll, and audio require multimodal evidence.",
    },
    {
      dimension: "meaningful_visual_support",
      status: params.hasVisualEvidence ? "mixed" : "unavailable",
      evidence: params.hasVisualEvidence
        ? "Frame evidence exists; visual value must be judged by whether it adds context, proof, or progression."
        : "No visual evidence was supplied.",
    },
    {
      dimension: "observed_retention",
      status: "unavailable",
      evidence: "No timestamped retention curve is attached to this analysis.",
    },
  ];

  return {
    rehooks,
    openLoops,
    evidenceFindings,
    progressEvents,
    hookWindows,
    progressDeserts,
    claimEvidenceMap,
    attentionSupport,
  };
}
