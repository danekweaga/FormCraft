import type { CreativeDirection, EditingBlueprint } from "./schema";

const DIRECTION_HINTS: Record<CreativeDirection, string[]> = {
  minimal_yap: [
    "Prefer natural delivery and light subtitles.",
    "Screenshots/proof only when they clarify a claim.",
    "Avoid frequent punch-ins unless content stalls.",
  ],
  clean_explainer: [
    "Prioritize diagrams, screenshots, and text hierarchy.",
    "Visuals should explain, not decorate.",
    "Keep information flow clear over hype.",
  ],
  high_energy: [
    "Allow faster visual resets around dense sections.",
    "Punch-ins/overlays/memes are creative options, not requirements.",
    "Still label suggestions as creative, not mandatory.",
  ],
  storytelling: [
    "Protect emotional pacing and reveal timing.",
    "Visual continuity can matter more than frequent cuts.",
    "Pauses may be intentional.",
  ],
  meme_heavy: [
    "Reaction/meme beats after serious setup can create contrast.",
    "Comedy timing is subjective — offer options.",
  ],
  my_style: ["Follow confirmed personal principles when available."],
  reference: ["Follow abstract reference principles — never copy timestamps."],
  custom: ["Follow the creator's custom creative brief."],
};

export function buildHeuristicBlueprint(params: {
  script: string;
  direction: CreativeDirection;
  stylePrinciples: string[];
  analysisTimeline?: Array<{
    startSeconds: number;
    endSeconds: number;
    type: string;
    transcript: string;
  }>;
}): EditingBlueprint {
  const words = params.script.split(/\s+/).filter(Boolean);
  const approxDuration = Math.max(24, Math.round(words.length / 2.5));
  const timeline =
    params.analysisTimeline && params.analysisTimeline.length > 0
      ? params.analysisTimeline
      : chunkScript(params.script, approxDuration);

  const beats = timeline.slice(0, 8).map((seg, index) => {
    const isHook = index === 0 || /hook/i.test(seg.type);
    const isDense =
      seg.transcript.split(/\s+/).length > 40 || /body|explanation/i.test(seg.type);
    const optional = optionalForDirection(params.direction, isHook, isDense);

    return {
      startSeconds: seg.startSeconds,
      endSeconds: seg.endSeconds,
      content: `${seg.type}: ${seg.transcript.slice(0, 120)}`,
      keep: isHook
        ? "Talking head / primary delivery for the opening claim."
        : "Preserve the spoken argument unless clarity suffers.",
      optional,
      why: isDense
        ? "Longer explanatory stretch — a visual reset is a creative option, not a rule."
        : isHook
          ? "Reinforces the opening claim without forcing a second visual idea."
          : "Supports communication for the selected creative direction.",
      evidenceKind: "creative_suggestion" as const,
      directionVariants: [
        {
          direction: "minimal_yap",
          suggestion: "Leave talking head; add emphasis text only if needed.",
        },
        {
          direction: "high_energy",
          suggestion: isDense
            ? "Consider a visual reset mid-section."
            : "Optional punch-in on the key phrase.",
        },
      ],
    };
  });

  return {
    version: "editing-blueprint-v1",
    creativeDirection: params.direction,
    summary: `Editing blueprint for ${params.direction.replace(/_/g, " ")}. Suggestions are creative options — not objective requirements.`,
    beats,
    stylePrinciplesUsed: [
      ...DIRECTION_HINTS[params.direction],
      ...params.stylePrinciples.slice(0, 6),
    ],
    confidenceNote:
      "No hard-coded cut cadence. Observations vs creative suggestions are labeled. Performance claims require separate evidence.",
  };
}

function chunkScript(script: string, duration: number) {
  const paras = script
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const parts = paras.length > 0 ? paras : [script];
  const slice = duration / parts.length;
  return parts.map((text, i) => ({
    startSeconds: Math.round(i * slice),
    endSeconds: Math.round((i + 1) * slice),
    type: i === 0 ? "Hook" : i === parts.length - 1 ? "Payoff" : "Body",
    transcript: text,
  }));
}

function optionalForDirection(
  direction: CreativeDirection,
  isHook: boolean,
  isDense: boolean,
): string | null {
  switch (direction) {
    case "minimal_yap":
      return isHook ? "Large hook text (optional)." : null;
    case "clean_explainer":
      return isDense ? "Screenshot or diagram if proof exists." : "Text hierarchy on key term.";
    case "high_energy":
      return isDense ? "Visual reset / punch-in option." : "Overlay emphasis.";
    case "storytelling":
      return isHook ? "Hold on face; delay B-roll." : "Allow pause; keep continuity.";
    case "meme_heavy":
      return isDense ? "Meme/reaction after the serious beat." : null;
    default:
      return isDense ? "Optional visual support if it clarifies." : null;
  }
}
