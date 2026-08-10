export type StarterPsychologyPrinciple = {
  name: string;
  description: string;
  mechanism: string;
  contentApplication: string;
  limitations: string;
  evidenceStrength: "limited" | "emerging" | "moderate" | "strong";
  source: {
    title: string;
    citation: string;
    doi: string;
    url: string;
  };
};

/**
 * Conservative starter set. The content applications are FormCraft's bounded
 * inferences from the cited work, not claims that the papers studied social video.
 */
export const STARTER_PSYCHOLOGY_PRINCIPLES: StarterPsychologyPrinciple[] = [
  {
    name: "Information gap",
    description: "Curiosity can arise when a person notices a specific gap between what they know and what they want to know.",
    mechanism: "Making a consequential missing piece salient can create motivation to resolve the gap.",
    contentApplication: "State the useful missing piece precisely in the hook, then close the gap in the video. Example: identify the debugging signal most beginners overlook—not merely 'wait until the end.'",
    limitations: "A gap without relevance, credibility, or a satisfying resolution becomes empty clickbait. The source is a broad review, not a test of short-form video hooks.",
    evidenceStrength: "moderate",
    source: {
      title: "The psychology of curiosity: A review and reinterpretation",
      citation: "Loewenstein, G. (1994). Psychological Bulletin, 116(1), 75–98.",
      doi: "10.1037/0033-2909.116.1.75",
      url: "https://doi.org/10.1037/0033-2909.116.1.75",
    },
  },
  {
    name: "Retrieval practice",
    description: "Actively retrieving learned material can improve later retention more than simply restudying it.",
    mechanism: "Recall practice strengthens access to a memory and exposes what the learner cannot yet retrieve.",
    contentApplication: "After explaining a concept, ask viewers to predict an output, spot a bug, or recall the steps before revealing the answer.",
    limitations: "The evidence concerns learning and memory, not reach or engagement. The prompt must remain answerable and the reveal should provide corrective feedback.",
    evidenceStrength: "strong",
    source: {
      title: "Test-enhanced learning: Taking memory tests improves long-term retention",
      citation: "Roediger, H. L., & Karpicke, J. D. (2006). Psychological Science, 17(3), 249–255.",
      doi: "10.1111/j.1467-9280.2006.01693.x",
      url: "https://doi.org/10.1111/j.1467-9280.2006.01693.x",
    },
  },
  {
    name: "Self-reference effect",
    description: "Information encoded in relation to oneself can be remembered better than information processed in less personal ways.",
    mechanism: "Relating material to an existing self-schema can create richer and more organized encoding cues.",
    contentApplication: "Frame an example as a viewer decision: 'Which of these project mistakes are you making?' or ask them to map the lesson to their current workflow.",
    limitations: "Personal relevance must be genuine. The classic studies concern memory for trait information, so performance claims for social content are an inference to test.",
    evidenceStrength: "moderate",
    source: {
      title: "Self-reference and the encoding of personal information",
      citation: "Rogers, T. B., Kuiper, N. A., & Kirker, W. S. (1977). Journal of Personality and Social Psychology, 35(9), 677–688.",
      doi: "10.1037/0022-3514.35.9.677",
      url: "https://doi.org/10.1037/0022-3514.35.9.677",
    },
  },
  {
    name: "Mere exposure",
    description: "Repeated exposure to a stimulus can increase positive affect or familiarity under some conditions.",
    mechanism: "Familiarity may make a stimulus easier or safer to process, which can influence evaluation.",
    contentApplication: "Repeat recognizable series names, visual motifs, and core beliefs so viewers can identify your work quickly while each episode still delivers something new.",
    limitations: "Repetition can also create boredom or wear-out. Familiarity is not proof of trust, accuracy, or conversion, and effects depend on context and exposure level.",
    evidenceStrength: "moderate",
    source: {
      title: "Attitudinal effects of mere exposure",
      citation: "Zajonc, R. B. (1968). Journal of Personality and Social Psychology, 9(2, Pt.2), 1–27.",
      doi: "10.1037/h0025848",
      url: "https://doi.org/10.1037/h0025848",
    },
  },
  {
    name: "Processing fluency",
    description: "Ease of processing can influence aesthetic response and judgments, although fluency is only one input to evaluation.",
    mechanism: "A smoothly processed stimulus can produce a positive metacognitive feeling that is attributed to the stimulus.",
    contentApplication: "Use concrete wording, readable on-screen text, one clear claim at a time, and visual continuity. Simplify presentation without oversimplifying the idea.",
    limitations: "Easy-to-process claims are not necessarily true. Fluency can amplify misinformation, and the cited review does not establish a universal content-performance formula.",
    evidenceStrength: "moderate",
    source: {
      title: "Processing fluency and aesthetic pleasure: Is beauty in the perceiver's processing experience?",
      citation: "Reber, R., Schwarz, N., & Winkielman, P. (2004). Personality and Social Psychology Review, 8(4), 364–382.",
      doi: "10.1207/S15327957PSPR0804_3",
      url: "https://doi.org/10.1207/S15327957PSPR0804_3",
    },
  },
  {
    name: "Observational learning",
    description: "People can learn behaviors by observing a model and the consequences around that behavior.",
    mechanism: "Attention, retention, reproduction, and motivation shape whether modeled behavior is learned or performed.",
    contentApplication: "Demonstrate the actual workflow, decision, or before-and-after behavior instead of only stating advice. Make the steps reproducible for the viewer.",
    limitations: "The foundational experiment studied modeled aggression in children. Applying the broader learning mechanism to creator education is indirect and should not be framed as a guaranteed engagement tactic.",
    evidenceStrength: "moderate",
    source: {
      title: "Transmission of aggression through imitation of aggressive models",
      citation: "Bandura, A., Ross, D., & Ross, S. A. (1961). Journal of Abnormal and Social Psychology, 63(3), 575–582.",
      doi: "10.1037/h0045925",
      url: "https://doi.org/10.1037/h0045925",
    },
  },
];
