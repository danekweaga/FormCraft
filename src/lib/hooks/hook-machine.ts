import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import { buildHookStoryPromptContext, getHookStorySystemPrompt } from "./starter-library";

/**
 * FormCraft adaptation of Kallaway's Hook Machine (research + generate + grade + revise).
 * Sandcastles MCP / credit-check steps are omitted; we use FormCraft research items.
 */
export const HOOK_MACHINE_SYSTEM_PROMPT = `You are the Hook Machine. Hook Researcher + Hook Generator + Hook Grader + Hook Reviser, all in one. You analyze top-performing short-form videos, extract winning hook patterns, and generate/grade/rewrite hooks for a new topic. You work across Instagram, TikTok, and YouTube Shorts.

Never claim you watched the video. Use only title, caption, metrics, and transcript/hook text when provided. Never invent personal results, stats, or proof. Never use an em-dash.

UNIVERSAL HOOK PRINCIPLES (always active)
1. Rapid Context: Communicate what the video is about in the first sentence. If the topic is not clear by the end of sentence one, the hook fails.
2. Clarity / Comprehension: Zero ambiguity. Unmistakable clarity. Comprehension loss is the #1 silent killer of hooks.
3. Contrast / Curiosity Loop: Distance between what the viewer currently believes and what you suggest. Bigger gap on a topic they care about = more hooked. Can be stated or implied.
4. Distillation: Fewest words possible. Every word must earn its place.
5. Specificity: Numbers, names, timeframes, concrete outcomes. "3 things" beats "a few things." "30 days" beats "quickly."
6. Absorption Rate: The viewer must process the hook at speaking speed. No jargon on a cold brain. No too-many-ideas sentence. It has to land on first listen.
7. Instant Value Promise: The hook itself contains what the viewer will get, not a tease that requires more watching.
8. Credibility Anchor (bonus): A proof point in lines 2-3 that validates the claim. Reward when natural. Do not penalize hooks that skip it.
9. Three-Part Alignment: The cover/text hook, spoken opening, and first visual must promise the same video. A strong sentence cannot rescue a mismatched first frame.

ANTI-PATTERNS (flag or rewrite)
- Vague superlatives without specifics
- Delayed topic context (topic unclear until sentence 2+)
- Confusing sentence logic
- Throat-clearing openers ("In my opinion," "So basically," "I want to talk about")
- Multiple disconnected points crammed into the hook
- Assumed knowledge / jargon on a cold brain
- Generic fear kickers that could attach to any topic
- Em-dashes: never use them. They read as AI-generated. Use periods, commas, or line breaks.

GRADING (holistic, not a checklist)
A+: all applicable principles firing. A: nearly all strong. A-: one identifiable weakness. B+: would perform, 1-2 improvements. B: functional but missing opportunities. B- and below: do not present as your own generated original hooks. Internally iterate original hooks until every one is B+ or above.

GENERATION
- Format-matched: adapt winning mad-lib formulas from the source hook/title only when the structure, tone, and word substitution still sound like a human would say them out loud. Cut bad fits. Do not pad.
- Original: write from scratch using the principles above. Channel-agnostic. Different approaches, not minor variations.
- Each rewrite of a user hook should take a different approach (structure vs value promise vs specificity).

FORMCRAFT HOOK + STORY ENGINE
${getHookStorySystemPrompt()}`;

export const hookPackItemSchema = z.object({
  text: z.string().min(8).max(280),
  textHook: z.string().max(140).default(""),
  spokenHook: z.string().max(280).default(""),
  visualHook: z.string().max(280).default("Show the subject or proof immediately."),
  alignmentNote: z.string().max(280).default("Text, speech, and visual should name the same promise."),
  grade: z.string(),
  note: z.string().max(240),
  formatLabel: z.string().max(80).optional(),
});

export const hookPackSchema = z.object({
  formatMatched: z.array(hookPackItemSchema).max(5),
  original: z.array(hookPackItemSchema).min(1).max(5),
});

export type HookPack = z.infer<typeof hookPackSchema>;

export function extractMadLibFormula(hook: string): string {
  return hook
    .replace(/\d[\d,.]*/g, "[number]")
    .replace(/\b\d+\s*(days?|weeks?|months?|years?|hours?|minutes?)\b/gi, "[timeframe]")
    .slice(0, 240);
}

export async function generateHookPackFromResearch(params: {
  supabase: SupabaseClient;
  userId: string;
  researchItemId: string;
  topic?: string | null;
}): Promise<{ pack: HookPack; usedLlm: boolean }> {
  const { data: item } = await params.supabase
    .from("research_items")
    .select(
      "id, title, description, hook_text, topic, analysis, outlier_score, platform, creator_name, views",
    )
    .eq("id", params.researchItemId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (!item) throw new Error("Research item not found.");

  const sourceHook = (item.hook_text || item.title || "").trim();
  const topic =
    params.topic?.trim() ||
    item.topic ||
    item.title ||
    "this niche";
  const formula = sourceHook ? extractMadLibFormula(sourceHook) : null;

  const fallback: HookPack = {
    formatMatched: sourceHook
      ? [
          {
            text: `The ${topic} result looks simple. The part that creates it is not.`,
            textHook: `${topic}: the hidden part`,
            spokenHook: `The ${topic} result looks simple. The part that creates it is not.`,
            visualHook: `Open on the real ${topic} result, then reveal the difficult step.`,
            alignmentNote: "All three elements contrast the visible result with the hidden process.",
            grade: "B+",
            note: "Transfers the contrast mechanism without copying the source wording. Add real proof.",
            formatLabel: "Transferred source mechanism",
          },
        ]
      : [],
    original: [
          {
            text: `Most ${topic} advice skips the part that actually changes the outcome.`,
            textHook: `${topic} advice skips this`,
            spokenHook: `Most ${topic} advice skips the part that actually changes the outcome.`,
            visualHook: `Show the exact skipped step or artifact in the first frame.`,
            alignmentNote: "The first frame must reveal the skipped part, not generic B-roll.",
            grade: "B+",
        note: "Contrast plus rapid context. Swap in a specific proof before publishing.",
      },
          {
            text: `Here is the ${topic} mistake that still shows up after people think they are past it.`,
            textHook: `The ${topic} mistake people miss`,
            spokenHook: `Here is the ${topic} mistake that still shows up after people think they are past it.`,
            visualHook: "Open on a real example of the mistake with the problem highlighted.",
            alignmentNote: "All three elements identify the same mistake.",
        grade: "B+",
        note: "Self-identification plus a competence gap. Add one concrete example.",
      },
          {
            text: `If you only remember one ${topic} rule, make it this.`,
            textHook: `One ${topic} rule`,
            spokenHook: `If you only remember one ${topic} rule, make it this.`,
            visualHook: "Put the rule or its concrete result on screen immediately.",
            alignmentNote: "Do not delay the rule after promising it.",
        grade: "B+",
        note: "Instant value promise. Follow with a specific rule, not a tease.",
      },
    ],
  };

  const result = await tryStructuredAI({
    supabase: params.supabase,
    fallback,
    input: {
      userId: params.userId,
      taskType: "idea_generation",
      role: "standard",
      promptVersion: "hook-machine-story-library-v3",
      cacheKey: hashAiInput([
        "hook-machine-story-library-v3",
        item.id,
        topic,
        sourceHook,
        item.outlier_score,
      ]),
      maxOutputTokens: 1600,
      temperature: 0.4,
      schema: hookPackSchema,
      messages: [
        {
          role: "system",
          content: [
            HOOK_MACHINE_SYSTEM_PROMPT,
            buildHookStoryPromptContext({
              objective: "awareness",
              format: "short-form video",
              query: topic,
              proofAvailable: Boolean(sourceHook),
            }),
            "For every hook return: text (same as spokenHook), textHook for the cover, spokenHook, visualHook for the first frame, and an alignmentNote. Transfer mechanisms from research, never wording or creator identity.",
          ].join("\n\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            topic,
            source: {
              platform: item.platform,
              creator: item.creator_name,
              title: item.title,
              spokenHook: item.hook_text,
              views: item.views,
              outlierScore: item.outlier_score,
              formula,
            },
            task: "Generate format-matched hooks (up to 5, only clean fits) and 5 original hooks graded B+ or above. Return JSON only.",
          }),
        },
      ],
    },
  });

  if (!result.usedLlm) {
    throw new Error(
      result.fallbackReason ??
        "OpenRouter did not generate hooks. Check OPENROUTER_API_KEY locally and on Vercel, then try again.",
    );
  }

  return { pack: result.data, usedLlm: result.usedLlm };
}
