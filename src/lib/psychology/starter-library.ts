export type StarterPsychologyPrinciple = {
  name: string;
  description: string;
  mechanism: string;
  contentApplication: string;
  limitations: string;
  evidenceStrength: "limited" | "emerging" | "moderate" | "strong";
  source: {
    sourceType?: "doi" | "pubmed" | "research_url";
    providerId?: string;
    title: string;
    citation: string;
    doi?: string;
    url: string;
  };
};

/**
 * Conservative starter set. The content applications are FormCraft's bounded
 * inferences from the cited work, not claims that the papers studied social video.
 */
export const STARTER_PSYCHOLOGY_PRINCIPLES: StarterPsychologyPrinciple[] = [
  {
    name: "Relevant state curiosity",
    description:
      "A clear, relevant unanswered question can focus information seeking and is associated with better memory for the sought information.",
    mechanism:
      "Curiosity directs processing toward resolving a specific information gap; it is not the same as vague withholding.",
    contentApplication:
      "Make the viewer's question, stakes, and path toward an answer intelligible. Provide progress while the question remains open, then deliver the promised payoff.",
    limitations:
      "The meta-analysis concerns memory, not guaranteed social-video retention. Curiosity can also reduce processing of unrelated information, so avoid opening a strong loop and then detouring.",
    evidenceStrength: "strong",
    source: {
      sourceType: "pubmed",
      providerId: "PMID:41748968",
      title: "Mnemonic benefits of state curiosity — A meta-analysis",
      citation: "Meta-analysis of 47 independent studies (PubMed PMID 41748968).",
      url: "https://pubmed.ncbi.nlm.nih.gov/41748968/",
    },
  },
  {
    name: "Meaningful segmentation and coherence",
    description:
      "Signaling, segmentation, coherence, and related multimedia principles generally support learning when they organize meaning and reduce irrelevant competition.",
    mechanism:
      "Viewers benefit when information is grouped around meaningful changes and visual or textual cues point toward the current idea.",
    contentApplication:
      "Segment around claims, examples, proof, contradictions, and payoffs. Prefer a screenshot that proves the claim over an arbitrary zoom that adds no information.",
    limitations:
      "This evidence primarily concerns multimedia learning, not a universal formula for short-form reach. More edits are not automatically better.",
    evidenceStrength: "strong",
    source: {
      sourceType: "doi",
      providerId: "DOI:10.3102/00346543211052329",
      title: "Multimedia Design for Learning: An Overview of Reviews With Meta-Meta-Analysis",
      citation: "Meta-meta-analysis of 29 reviews, 1,189 studies, and 78,177 participants (2022).",
      doi: "10.3102/00346543211052329",
      url: "https://journals.sagepub.com/doi/10.3102/00346543211052329",
    },
  },
  {
    name: "Fragmentation is not progression",
    description:
      "Breaking material into more short units does not guarantee better integration or memory.",
    mechanism:
      "Frequent fragmentation can interrupt the integration of related information even when total content and duration are similar.",
    contentApplication:
      "Count informational progress separately from cuts. Compress repeated explanation before adding decorative pattern interrupts.",
    limitations:
      "The cited controlled study had 57 participants and studied learning and memory. It does not establish an optimal edit rate for social video.",
    evidenceStrength: "emerging",
    source: {
      sourceType: "pubmed",
      providerId: "PMID:41519954",
      title: "Fragmented learning from short videos modulates neural activity and connectivity during memory retrieval",
      citation: "Controlled short-versus-continuous video study, 57 participants (PubMed PMID 41519954).",
      url: "https://pubmed.ncbi.nlm.nih.gov/41519954/",
    },
  },
  {
    name: "Caption competition risk",
    description:
      "Captions can support comprehension, but difficult or dense subtitles can absorb substantial visual processing.",
    mechanism:
      "Simultaneous speech, dense text, and complex visual proof can compete for limited processing resources.",
    contentApplication:
      "Use captions to signal hierarchy. When showing code or visual proof, simplify captions or give the evidence enough screen time to be read.",
    limitations:
      "The cited eye-tracking comparison concerns Arabic subtitle quality, not a universal caption-density threshold for Reels or TikTok.",
    evidenceStrength: "emerging",
    source: {
      sourceType: "pubmed",
      providerId: "PMID:40708801",
      title: "Through the Eyes of the Viewer: Cognitive Load of LLM-Generated vs Professional Arabic Subtitles",
      citation: "Eye-tracking subtitle study (PubMed PMID 40708801).",
      url: "https://pubmed.ncbi.nlm.nih.gov/40708801/",
    },
  },
  {
    name: "Emotion should advance the message",
    description:
      "Emotion can support memorable encoding, but emotionally loaded interpretation can also compete with memory for the video itself.",
    mechanism:
      "Emotion is most defensible when it is part of the event, stakes, or payoff rather than an unrelated layer demanding attention.",
    contentApplication:
      "Use emotional reactions, music, or text when they clarify the story or consequence. Avoid unrelated dramatic decoration over a demanding explanation.",
    limitations:
      "The cited study examines video memory, not social performance, and does not imply that low-emotion content is inferior.",
    evidenceStrength: "moderate",
    source: {
      sourceType: "pubmed",
      providerId: "PMID:42393484",
      title: "Video, text, and memory: An emotional verbal overshadowing effect",
      citation: "Video-memory study with 649 participants (PubMed PMID 42393484).",
      url: "https://pubmed.ncbi.nlm.nih.gov/42393484/",
    },
  },
  {
    name: "Proof and credibility are contextual",
    description:
      "Credibility cues can affect persuasion, but their effect depends on the source, audience, claim, and context.",
    mechanism:
      "Concrete demonstrations and attributable evidence help viewers evaluate a claim instead of relying on unsupported authority language.",
    contentApplication:
      "Map important claims to personal experience, a live demonstration, code or results, screenshots, numbers, external sources, or honest limitations.",
    limitations:
      "The cited experiment concerns clinical-trial TikToks. Its exact effects should not be generalized to CS or developer content.",
    evidenceStrength: "emerging",
    source: {
      sourceType: "pubmed",
      providerId: "PMID:38699819",
      title: "Trust Me, I'm a Doctor: How TikTok Videos from Different Sources Influence Clinical Trial Participation",
      citation: "Short-form source-credibility experiment, 396 participants (PubMed PMID 38699819).",
      url: "https://pubmed.ncbi.nlm.nih.gov/38699819/",
    },
  },
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
