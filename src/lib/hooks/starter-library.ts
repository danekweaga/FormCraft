import libraryJson from "@/data/formcraft-hook-story-script-library.json";

export const HOOK_STORY_LIBRARY_ID = "formcraft-hook-story-script-library";

export type CanonicalHookTemplate = {
  canonical_id: string;
  template: string;
  family: string;
  jobs: string[];
  source_entries: string[];
  source_banks: string[];
  source_statuses: string[];
  requires: string[];
  risk_flags: string[];
  notes: string[];
  suggested_script_architectures?: string[];
};

type ScriptArchitecture = {
  id: string;
  name: string;
  best_for: string[];
  beats: unknown[];
  special_rules: string[];
};

type HookStoryLibrary = {
  library_name: string;
  version: string;
  purpose: string;
  counts: {
    canonical_unique_templates: number;
    script_architectures: number;
    rehooks: number;
    attention_anchor_types: number;
  };
  hook_engine: Record<string, unknown>;
  runtime_rules: string[];
  progress_event_types: string[];
  attention_anchors: unknown[];
  primers: unknown[];
  rehooks: string[];
  script_architectures: ScriptArchitecture[];
  raw_hook_entries: unknown[];
  canonical_hooks: CanonicalHookTemplate[];
  script_output_schema: Record<string, unknown>;
  formcraft_system_prompt: string;
  ethical_guardrails: Record<string, unknown>;
  source_model: Record<string, string>;
  hook_bank_metadata?: {
    viral_hooks_255?: {
      unique_templates_in_source: number;
      usage_rule: string;
    };
  };
  hook_to_story_bridge?: Record<
    string,
    { default_architecture: string; continuation: string }
  >;
};

const library = libraryJson as unknown as HookStoryLibrary;

const objectiveFamilies: Record<string, string[]> = {
  awareness: ["curiosity_gap", "pattern_interrupt", "question", "contrast"],
  reach: ["curiosity_gap", "pattern_interrupt", "question", "contrast"],
  follows: ["identity_self_reference", "storytelling", "authority", "reframe"],
  trust: ["authority", "storytelling", "experiment_result", "confession", "reframe"],
  education: ["authority", "how_to", "question", "reframe", "listicle", "curiosity_gap"],
  community: ["identity_self_reference", "self_audit", "question", "storytelling"],
  saves: ["authority", "question", "curiosity_gap", "reframe"],
  shares: ["reframe", "controversy", "identity_self_reference", "storytelling"],
  leads: ["authority", "comparison", "loss_framing", "storytelling"],
  conversion: ["authority", "comparison", "loss_framing", "storytelling"],
  documentation: ["storytelling", "confession", "experiment_result", "reframe"],
};

const formatFamilies: Array<{ pattern: RegExp; families: string[] }> = [
  { pattern: /stor(y|ies)|personal|journey/i, families: ["storytelling", "confession", "reframe"] },
  { pattern: /compar|versus|\bvs\b/i, families: ["comparison", "contrast", "question"] },
  { pattern: /experiment|test|review/i, families: ["experiment_result", "authority", "storytelling"] },
  { pattern: /tutorial|how[- ]?to|educat|explain/i, families: ["how_to", "authority", "question", "listicle", "curiosity_gap"] },
  { pattern: /news|breakdown/i, families: ["authority", "pattern_interrupt", "reframe"] },
  { pattern: /talking head|yap|reality check/i, families: ["reframe", "storytelling", "identity_self_reference"] },
];

const architectureRules: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /stor(y|ies)|personal|journey/i, id: "story_yap" },
  { pattern: /compar|versus|\bvs\b/i, id: "comparison" },
  { pattern: /experiment|test|review|ai tool/i, id: "experiment_tool_test" },
  { pattern: /tutorial|how[- ]?to/i, id: "tutorial" },
  { pattern: /news|breakdown/i, id: "news_breakdown" },
  { pattern: /founder|market/i, id: "founder_market_disconnect" },
  { pattern: /product.*wrong|wrong.*turn/i, id: "product_wrong_turn" },
  { pattern: /product|launch/i, id: "personal_origin_product" },
  { pattern: /educat|explain|technical/i, id: "educational_explainer" },
  { pattern: /talking head|yap|reality check/i, id: "yap_talking_head" },
];

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function deterministicStart(seed: string, length: number): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return length ? (hash >>> 0) % length : 0;
}

function rotateForContext(
  templates: CanonicalHookTemplate[],
  seed: string,
): CanonicalHookTemplate[] {
  if (templates.length < 2) return templates;
  const start = deterministicStart(seed, templates.length);
  return [...templates.slice(start), ...templates.slice(0, start)];
}

function contextualPair(
  templates: CanonicalHookTemplate[],
  seed: string,
): CanonicalHookTemplate[] {
  const rotated = rotateForContext(templates, seed);
  const primary = rotated[0];
  if (!primary) return [];
  const complementary = rotated.find(
    (template) =>
      template.canonical_id !== primary.canonical_id &&
      template.source_banks.includes("viral_hooks_255") !==
        primary.source_banks.includes("viral_hooks_255"),
  );
  return [primary, complementary ?? rotated[1]].filter(
    (template): template is CanonicalHookTemplate => Boolean(template),
  );
}

function requiresUnavailableProof(template: CanonicalHookTemplate): boolean {
  return template.requires.some((requirement) =>
    /verified|real_credential|real_social_proof|firsthand_proof|proof_if_claim/i.test(requirement),
  );
}

function inferFamilies(query: string): string[] {
  const matches: string[] = [];
  for (const rule of formatFamilies) {
    if (rule.pattern.test(query)) matches.push(...rule.families);
  }
  if (/mistake|wrong|myth|dead|outdated|stop/i.test(query)) matches.push("reframe", "controversy");
  if (/beginner|student|you|your/i.test(query)) matches.push("identity_self_reference", "self_audit");
  return unique(matches);
}

export function getHookStoryLibrarySummary() {
  return {
    name: library.library_name,
    version: library.version,
    purpose: library.purpose,
    canonicalHooks: library.canonical_hooks.length,
    rawHooks: library.raw_hook_entries.length,
    architectures: library.script_architectures.length,
    rehooks: library.rehooks.length,
    attentionAnchors: library.attention_anchors.length,
    viralSwipeHooks:
      library.hook_bank_metadata?.viral_hooks_255?.unique_templates_in_source ?? 0,
  };
}

export function getCanonicalHookTemplates(): CanonicalHookTemplate[] {
  return library.canonical_hooks;
}

export function getHookStorySystemPrompt(): string {
  return library.formcraft_system_prompt;
}

export function selectHookTemplates(params: {
  objective?: string | null;
  format?: string | null;
  query?: string | null;
  proofAvailable?: boolean;
  limit?: number;
}): CanonicalHookTemplate[] {
  const objective = params.objective?.toLowerCase().trim() || "trust";
  const format = params.format?.trim() || "";
  const query = params.query?.trim() || "";
  const families = unique([
    ...inferFamilies(`${format} ${query}`),
    ...(objectiveFamilies[objective] ?? objectiveFamilies.trust),
  ]);
  const limit = Math.min(8, Math.max(3, params.limit ?? 8));
  const selected: CanonicalHookTemplate[] = [];

  for (const family of families) {
    const matches = library.canonical_hooks.filter((template) => {
      if (template.family !== family) return false;
      if (template.risk_flags.length > 0) return false;
      if (params.proofAvailable === false && requiresUnavailableProof(template)) return false;
      return true;
    });
    selected.push(
      ...contextualPair(matches, `${objective}:${format}:${query}:${family}`),
    );
    if (selected.length >= limit) break;
  }

  if (selected.length < limit) {
    const selectedIds = new Set(selected.map((template) => template.canonical_id));
    const fallback = library.canonical_hooks.filter((template) => {
      if (selectedIds.has(template.canonical_id) || template.risk_flags.length > 0) return false;
      return params.proofAvailable !== false || !requiresUnavailableProof(template);
    });
    selected.push(...fallback.slice(0, limit - selected.length));
  }

  return selected.slice(0, limit);
}

export function selectScriptArchitecture(
  format?: string | null,
  hookFamily?: string | null,
): ScriptArchitecture {
  const normalized = format?.trim() || "";
  const id =
    architectureRules.find((rule) => rule.pattern.test(normalized))?.id ??
    (hookFamily ? library.hook_to_story_bridge?.[hookFamily]?.default_architecture : null) ??
    "yap_talking_head";
  return (
    library.script_architectures.find((architecture) => architecture.id === id) ??
    library.script_architectures[0]
  );
}

export function buildHookStoryPromptContext(params: {
  objective?: string | null;
  format?: string | null;
  query?: string | null;
  proofAvailable?: boolean;
}): string {
  const templates = selectHookTemplates(params).map((template) => ({
    id: template.canonical_id,
    template: template.template,
    family: template.family,
    jobs: template.jobs,
    requires: template.requires,
    sourceStatus: template.source_statuses,
  }));
  const primaryFamily = templates[0]?.family ?? null;
  const architecture = selectScriptArchitecture(params.format, primaryFamily);
  const storyBridge = primaryFamily
    ? library.hook_to_story_bridge?.[primaryFamily] ?? null
    : null;

  return [
    `FORMCRAFT HOOK + STORY LIBRARY ${library.version}`,
    "This is a deterministic, task-matched selection from the bundled library. Templates are options, not instructions to force a fit.",
    `Selected templates:\n${JSON.stringify(templates, null, 2)}`,
    `Selected story architecture:\n${JSON.stringify(architecture, null, 2)}`,
    storyBridge
      ? `Hook-to-story continuation:\n${JSON.stringify(storyBridge, null, 2)}`
      : "Hook-to-story continuation: use the selected architecture and earn the promised payoff.",
    library.hook_bank_metadata?.viral_hooks_255?.usage_rule
      ? `Viral swipe-bank rule:\n${library.hook_bank_metadata.viral_hooks_255.usage_rule}`
      : "",
    `Runtime rules:\n${library.runtime_rules.map((rule) => `- ${rule}`).join("\n")}`,
    `Ethical guardrails:\n${JSON.stringify(library.ethical_guardrails, null, 2)}`,
  ].join("\n\n");
}

export function buildHookStoryKnowledgeText(): string {
  return [
    `# ${library.library_name}`,
    `Version: ${library.version}`,
    library.purpose,
    "",
    "This starter document is installed by FormCraft. Creator frameworks are useful hypotheses to test, not platform laws or scientific guarantees.",
    "",
    "## FormCraft Hook + Story system prompt",
    library.formcraft_system_prompt,
    "",
    "## Complete structured library",
    "The JSON below preserves every canonical template, raw source entry, story architecture, selection rule, rehook, attention anchor, provenance label, output schema, and guardrail supplied with the library.",
    "",
    JSON.stringify(library, null, 2),
  ].join("\n");
}
