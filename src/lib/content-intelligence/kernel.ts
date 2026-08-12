import type { ContextTaskType } from "@/lib/ai/models/types";

export const CONTENT_INTELLIGENCE_VERSION = "formcraft-content-intelligence-v1";

export const CONTENT_SYSTEM_STAGES = [
  { key: "identity", label: "Identity", question: "What must you become known for?" },
  { key: "audience", label: "Audience", question: "Who needs this and what do they feel now?" },
  { key: "idea", label: "Idea", question: "What single useful change will this content create?" },
  { key: "angle", label: "Angle", question: "What is your distinct, credible interpretation?" },
  { key: "format", label: "Format", question: "What delivery method makes the idea easiest to understand?" },
  { key: "hook", label: "Hook", question: "Why should the right viewer stop now?" },
  { key: "retention", label: "Retention", question: "How does value progress without wasting attention?" },
  { key: "proof", label: "Proof", question: "What makes the claim believable?" },
  { key: "payoff", label: "Payoff", question: "Does the content fulfill the opening promise?" },
  { key: "cta", label: "CTA", question: "What is the most natural next action?" },
  { key: "packaging", label: "Packaging", question: "Do cover, caption, and search language match the content?" },
  { key: "distribution", label: "Distribution", question: "How should this idea adapt across platforms?" },
  { key: "experiment", label: "Experiment", question: "What one variable are you testing?" },
  { key: "analytics", label: "Analytics", question: "Which metric matches the objective?" },
  { key: "learning", label: "Learning", question: "What evidence should change the next idea?" },
] as const;

export const SOURCE_STATUSES = [
  "research_or_platform",
  "creator_framework",
  "creator_claim",
  "mentor_feedback",
  "user_observation",
  "formcraft_synthesis",
] as const;

export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  research_or_platform: "Research or platform evidence",
  creator_framework: "Creator framework",
  creator_claim: "Creator claim to test",
  mentor_feedback: "Mentor feedback",
  user_observation: "Your observation",
  formcraft_synthesis: "FormCraft synthesis",
};

export const QUALITY_GATE_DIMENSIONS = [
  "audience relevance",
  "one clear idea",
  "brand fit",
  "format fit",
  "text, spoken, and visual hook alignment",
  "retention progression",
  "proof and claim honesty",
  "payoff fulfillment",
  "CTA and objective fit",
  "originality",
  "voice match",
  "production feasibility",
  "platform packaging",
  "one-variable learning plan",
] as const;

export type FormatSignal =
  | "intimacy"
  | "opinion"
  | "transformation"
  | "visual_proof"
  | "speed"
  | "multi_step"
  | "abstract"
  | "current_event"
  | "comparison"
  | "entertainment"
  | "credibility_test"
  | "return_behavior"
  | "lead_generation"
  | "sponsor"
  | "fast_test";

export const FORMAT_ROUTES: Record<
  FormatSignal,
  { label: string; structure: string; primaryMetric: string }
> = {
  intimacy: {
    label: "Yap / direct-to-camera",
    structure: "specific tension -> honest point of view -> proof or example -> takeaway",
    primaryMetric: "meaningful comments or shares",
  },
  opinion: {
    label: "Yap / commentary",
    structure: "clear position -> why the common view misses -> evidence -> implication",
    primaryMetric: "qualified engagement",
  },
  transformation: {
    label: "Story",
    structure: "before -> catalyst -> struggle or decision -> after -> lesson",
    primaryMetric: "retention through payoff",
  },
  visual_proof: {
    label: "Screen-first demo / case study",
    structure: "show result -> show starting point -> demonstrate steps -> verify result",
    primaryMetric: "saves or qualified profile actions",
  },
  speed: {
    label: "B-roll / simple clip",
    structure: "visual context -> concise claim -> supporting beats -> takeaway",
    primaryMetric: "completion rate",
  },
  multi_step: {
    label: "List, tutorial, or carousel",
    structure: "promise -> ordered steps -> example per step -> summary",
    primaryMetric: "saves",
  },
  abstract: {
    label: "Analogy / visual explainer",
    structure: "familiar object -> map the concept -> test the analogy -> practical meaning",
    primaryMetric: "shares and comprehension comments",
  },
  current_event: {
    label: "Commentary",
    structure: "what happened -> what it means -> evidence -> creator-specific implication",
    primaryMetric: "timely reach and qualified discussion",
  },
  comparison: {
    label: "Versus / comparison panel",
    structure: "decision -> criteria -> side-by-side proof -> recommendation by use case",
    primaryMetric: "saves or search discovery",
  },
  entertainment: {
    label: "Skit / POV",
    structure: "recognizable situation -> escalating tension -> reversal -> insight",
    primaryMetric: "shares and completion rate",
  },
  credibility_test: {
    label: "Tool experiment",
    structure: "hypothesis -> method -> result -> limitation -> verdict",
    primaryMetric: "trust signals, saves, and follows",
  },
  return_behavior: {
    label: "Series / challenge",
    structure: "series promise -> episode question -> progress -> next-episode open loop",
    primaryMetric: "return viewers and follows",
  },
  lead_generation: {
    label: "Lead-magnet content",
    structure: "specific problem -> useful preview -> proof -> transparent resource CTA",
    primaryMetric: "qualified conversions",
  },
  sponsor: {
    label: "Native integration",
    structure: "real problem -> natural product use -> demonstrated result -> honest limitation",
    primaryMetric: "qualified clicks or conversions",
  },
  fast_test: {
    label: "Trial Reel",
    structure: "one premise -> one hook -> one proof beat -> one payoff",
    primaryMetric: "chosen experiment metric",
  },
};

export function routeFormat(signals: FormatSignal[]) {
  return signals.map((signal) => FORMAT_ROUTES[signal]);
}

const FOUNDATION = `FORMCRAFT CONTENT INTELLIGENCE (${CONTENT_INTELLIGENCE_VERSION})
Use this operating chain: identity -> audience -> idea -> angle -> format -> hook -> retention -> proof -> payoff -> CTA -> packaging -> distribution -> experiment -> analytics -> learning -> next idea.

Diagnose the weakest link before recommending a fix. Do not default to hook advice. Keep idea, angle, format, and hook separate.

SOURCE RELIABILITY
Classify important claims as research_or_platform, creator_framework, creator_claim, mentor_feedback, user_observation, or formcraft_synthesis. Creator anecdotes, algorithm theories, revenue claims, view claims, and guarantees are claims to test, not facts. If sources conflict: disclose the disagreement, state the shared principle, explain the contexts where each may apply, and propose a one-variable test. Never invent authority, research, results, testimonials, scarcity, or platform certainty.

CONTENT STANDARD
Target the intended viewer, communicate one useful idea, create an honest reason to continue, deliver value or perspective, show proof where needed, preserve the creator's voice, fulfill the payoff, give a natural next action, reinforce the brand, and create a measurable learning. Text hook, spoken hook, and opening visual must promise the same video. Captions and covers package the content; they do not replace it. Never copy an outlier's identity or wording. Transfer only the mechanism and build a new angle, proof, structure, and conclusion.

QUALITY GATE
Review audience relevance, one clear idea, brand fit, format fit, hook alignment, retention progression, proof honesty, payoff, CTA fit, originality, voice, feasibility, packaging, and experiment design. Use Ready, Revise, Rethink, or Verify. Experiments change one meaningful variable and use a metric that matches the objective. Analyze the retention curve or supplied evidence before prescribing rewrites. Never guarantee virality.`;

const TASK_RULES: Partial<Record<ContextTaskType, string>> = {
  idea_generation:
    "IDEA TASK: Identify the audience problem, objective, distinct angle, available proof, audience awareness level, value mode, best format and why, text/spoken/visual hook package, payoff, CTA, and one test variable. Outliers provide transferable mechanisms, not scripts to paraphrase.",
  idea_evaluation:
    "IDEA GATE TASK: Decide whether the idea is worth making. Evaluate audience relevance, brand fit, originality, proof available, best formats, possible hook angles, series potential, conversion fit, production effort, duplicate risk, and claim risk. Give a specific reshape when it is not ready.",
  script_generation:
    "SCRIPT TASK: Build progression, not filler. Use a primer or qualification line only when needed, then escalating value, proof beats, rehooks, a fulfilled payoff, and one objective-matched CTA. Mark missing personal proof with a bracketed request instead of inventing it. Return packaging separately from the script.",
  content_analysis:
    "ANALYSIS TASK: Diagnose using only supplied evidence. Separate transcript, visual, audio, platform, and retention evidence. Identify the weakest system stage and the exact support. Do not infer watch-time causes without a retention curve. Recommend the smallest high-leverage change and a test.",
  research_analysis:
    "RESEARCH TASK: Extract topic, audience, packaging, hook mechanism, format, emotion, proof, story, CTA, dependencies, and transferable mechanism. Produce original recreation angles. Treat captions as metadata unless a transcript is explicitly supplied.",
  pre_publish_review:
    "PRE-PUBLISH TASK: Apply the 14-part quality gate. Flag unsupported claims and missing proof. Verify alignment between cover/text hook, spoken opening, opening visual, body, payoff, and CTA. Return Ready, Revise, Rethink, or Verify with prioritized changes.",
  editing_guidance:
    "EDITING TASK: Plan edits around comprehension, progression, proof, rehooks, pattern changes, and payoff. Do not prescribe arbitrary cuts every two seconds. Tie each edit to a specific attention or clarity job.",
  content_remix:
    "REMIX TASK: Preserve the core insight while creating platform-native versions under one content_family_id. Adapt the hook, pacing, proof presentation, packaging, and CTA without changing the truth of the claim.",
  experiment_analysis:
    "EXPERIMENT TASK: Confirm that one variable changed, compare the objective-matched metric against a fair baseline, state uncertainty and sample size, then choose keep, revise, retest, or retire.",
  performance_review:
    "PERFORMANCE TASK: Interpret metrics by objective rather than views alone. Separate reach, retention, trust, community, and conversion signals. State data limitations and turn supported patterns into the next test.",
  weekly_review:
    "LEARNING TASK: Separate observations from supported lessons. Show what changed, what repeated, what remains uncertain, which winner is worth scaling, and the next one-variable experiment.",
  lesson_generation:
    "LESSON TASK: Only promote repeated or well-supported evidence into a lesson. Include scope, sample size, confidence, exceptions, and the next falsifiable test.",
};

export function contentIntelligencePromptBlock(taskType: ContextTaskType): string {
  return [FOUNDATION, TASK_RULES[taskType] ?? "Apply the operating chain and quality gate to this task."].join("\n\n");
}

export const DEFAULT_CREATOR_STARTING_POINT = {
  promise:
    "Help ambitious CS students turn projects, AI experiments, school, hackathons, internships, and early-career lessons into practical evidence and clearer next steps.",
  audience:
    "CS students and early-career builders who want stronger projects and opportunities but feel overloaded, behind, or unsure what actually matters.",
  pointOfView:
    "Document what is being learned with specific proof. Be direct, conversational, useful, and honest about what is still uncertain.",
  proofRule:
    "Use real demos, artifacts, decisions, comparisons, results, and personal context. Never invent experience or imply outcomes that cannot be shown.",
};
