import type { SupabaseClient } from "@supabase/supabase-js";
import { hashAiInput, tryStructuredAI } from "@/lib/ai/client";
import { callOpenRouter } from "@/lib/ai/models/openrouter";
import { resolveModelTier } from "@/lib/ai/models/router";
import type { LlmResult, ModelTier } from "@/lib/ai/models/types";
import { z } from "zod";

export const postClassificationSchema = z.object({
  topic: z.string().nullable(),
  content_pillar: z.string().nullable(),
  format: z.string().nullable(),
  hook_type: z.string().nullable(),
  cta_type: z.string().nullable(),
  story_presence: z.boolean(),
  personal_story_presence: z.boolean(),
  opinion_strength: z.enum(["low", "medium", "high"]),
  content_mode: z.enum([
    "educational",
    "opinion",
    "story",
    "entertainment",
    "mixed",
    "unknown",
  ]),
  structure: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type PostClassification = z.infer<typeof postClassificationSchema>;

const TOPIC_RULES: Array<{
  topic: string;
  contentPillar: string;
  pattern: RegExp;
}> = [
  {
    topic: "Developer security & secrets",
    contentPillar: "developer_education",
    pattern: /(?:\.env|api key|secret credential|leaked? key|environment variable)/i,
  },
  {
    topic: "AI tool comparisons",
    contentPillar: "ai_tools",
    pattern: /(?:chatgpt\s+(?:vs|or)\s+claude|claude\s+(?:vs|or)\s+chatgpt|ai tool comparison)/i,
  },
  {
    topic: "LeetCode & interview prep",
    contentPillar: "career_growth",
    pattern: /(?:leetcode|coding interview|technical interview|data structures?|algorithms?)/i,
  },
  {
    topic: "Tutorial dependency & self-learning",
    contentPillar: "learning_strategy",
    pattern: /(?:tutorial hell|depending on tutorials?|stop tutorials?|self[- ]taught|learning to code)/i,
  },
  {
    topic: "CS careers & internships",
    contentPillar: "career_growth",
    pattern: /(?:internships?|résumés?|resumes?|job search|computer science career|software engineering career)/i,
  },
  {
    topic: "Projects & portfolios",
    contentPillar: "project_building",
    pattern: /(?:portfolio|side projects?|github|building projects?|project ideas?)/i,
  },
  {
    topic: "Hackathons",
    contentPillar: "project_building",
    pattern: /(?:hackathons?|devpost)/i,
  },
  {
    topic: "AI-assisted coding",
    contentPillar: "ai_tools",
    pattern: /(?:vibe ?cod(?:e|er|ing)|ai cod(?:e|ing)|cursor ai|github copilot|lovable|bolt\.new|replit agent)/i,
  },
  {
    topic: "Coding & debugging",
    contentPillar: "developer_education",
    pattern: /(?:debugg?ing|html|css|javascript|typescript|python|coding mistake|programming)/i,
  },
  {
    topic: "CS student life",
    contentPillar: "student_life",
    pattern: /(?:computer science|cs students?|csstudents|college coder|university student)/i,
  },
];

function titleCaseHashtag(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferTopic(text: string): {
  topic: string | null;
  contentPillar: string | null;
  confidence: number;
} {
  const rule = TOPIC_RULES.find((candidate) => candidate.pattern.test(text));
  if (rule) {
    return {
      topic: rule.topic,
      contentPillar: rule.contentPillar,
      confidence: 0.72,
    };
  }

  const ignoredTags = new Set([
    "fyp",
    "viral",
    "reels",
    "shorts",
    "coding",
    "programming",
    "computerscience",
    "csstudents",
  ]);
  const hashtag = [...text.matchAll(/#([a-z][a-z0-9_-]{2,30})/gi)]
    .map((match) => match[1]!.toLowerCase())
    .find((tag) => !ignoredTags.has(tag));
  return hashtag
    ? {
        topic: titleCaseHashtag(hashtag),
        contentPillar: "niche_topic",
        confidence: 0.55,
      }
    : { topic: null, contentPillar: null, confidence: 0.35 };
}

export function classifyPostHeuristic(input: {
  caption: string | null;
  title: string | null;
  transcript?: string | null;
  format: string | null;
  durationSeconds: number | null;
}): PostClassification {
  const suppliedTranscript = input.transcript?.trim() ?? "";
  const text = [suppliedTranscript, input.title, input.caption]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  const topic = inferTopic(text);
  const personal =
    /\b(i |my |me |i'm|i’ve|i've|when i|last week|internship|my team)\b/.test(
      text,
    );
  const opinion =
    /\b(stop|never|always|wrong|truth|most people|nobody|hate|love)\b/.test(
      text,
    );
  const educational =
    /\b(how to|guide|tips|learn|framework|step|why you should)\b/.test(text);
  const questionHook = /^\s*(why|what|how|do you|are you|is your)/i.test(
    suppliedTranscript || input.caption || input.title || "",
  );
  const contrarian = /\b(stop|don't|never|wrong|myth|lie)\b/i.test(text);

  let content_mode: PostClassification["content_mode"] = "unknown";
  if (personal && !educational) content_mode = "story";
  else if (educational && opinion) content_mode = "mixed";
  else if (educational) content_mode = "educational";
  else if (opinion) content_mode = "opinion";

  return {
    topic: topic.topic,
    content_pillar:
      topic.contentPillar ??
      (personal ? "personal_story" : educational ? "education" : null),
    format:
      input.format ??
      (input.durationSeconds && input.durationSeconds <= 90 ? "short" : null),
    hook_type: contrarian
      ? "contrarian"
      : questionHook
        ? "question"
        : personal
          ? "personal"
          : "other",
    cta_type: /\b(comment|follow|save|share|link in bio)\b/i.test(text)
      ? "engagement"
      : null,
    story_presence: personal || /\bstory\b/.test(text),
    personal_story_presence: personal,
    opinion_strength: opinion ? "high" : personal ? "medium" : "low",
    content_mode,
    structure: personal
      ? "personal_example_first"
      : educational
        ? "claim_then_steps"
        : null,
    confidence: Math.max(topic.confidence, suppliedTranscript ? 0.58 : 0.45),
  };
}

const PROMPT_VERSION = "classify-post-v2";

export async function classifyPost(input: {
  caption: string | null;
  title: string | null;
  transcript?: string | null;
  format: string | null;
  durationSeconds: number | null;
  modelName?: string;
  modelTier?: ModelTier;
  /** When provided, uses FormCraft AI client (budget, cache, jobs). */
  supabase?: SupabaseClient;
  userId?: string;
}): Promise<{
  classification: PostClassification;
  model: string;
  llm?: LlmResult;
  cached?: boolean;
}> {
  const heuristic = classifyPostHeuristic(input);
  const cacheKey = hashAiInput([
    PROMPT_VERSION,
    input.title,
    input.caption,
    input.transcript,
    input.format,
    input.durationSeconds,
  ]);

  if (input.supabase && input.userId) {
    const result = await tryStructuredAI({
      supabase: input.supabase,
      fallback: heuristic,
      input: {
        userId: input.userId,
        taskType: "content_classification",
        role: "cheap",
        promptVersion: PROMPT_VERSION,
        cacheKey,
        modelName: input.modelName,
        maxOutputTokens: 400,
        schema: postClassificationSchema,
        messages: [
          {
            role: "system",
            content:
              "Classify creator short-form content. Return ONLY JSON matching keys: topic, content_pillar, format, hook_type, cta_type, story_presence, personal_story_presence, opinion_strength (low|medium|high), content_mode (educational|opinion|story|entertainment|mixed|unknown), structure, confidence (0-1). No visuals unless described.",
          },
          {
            role: "user",
            content: JSON.stringify({
              title: input.title,
              caption: input.caption,
              transcript: input.transcript,
              format: input.format,
              durationSeconds: input.durationSeconds,
            }),
          },
        ],
      },
    });
    return {
      classification: result.data,
      model: result.usedLlm ? result.model : "heuristic-v1",
      cached: result.cached,
    };
  }

  // Legacy path without supabase (tests / callers)
  const tier = input.modelTier ?? resolveModelTier("content_classification");
  try {
    const llm = await callOpenRouter({
      tier,
      modelName: input.modelName,
      maxOutputTokens: 400,
      messages: [
        {
          role: "system",
          content:
            "Classify creator short-form content. Return ONLY JSON matching keys: topic, content_pillar, format, hook_type, cta_type, story_presence, personal_story_presence, opinion_strength (low|medium|high), content_mode (educational|opinion|story|entertainment|mixed|unknown), structure, confidence (0-1). No visuals unless described.",
        },
        {
          role: "user",
          content: JSON.stringify({
            title: input.title,
            caption: input.caption,
            transcript: input.transcript,
            format: input.format,
            durationSeconds: input.durationSeconds,
          }),
        },
      ],
    });
    if (!llm?.text) {
      return { classification: heuristic, model: "heuristic-v1" };
    }
    const jsonStart = llm.text.indexOf("{");
    const jsonEnd = llm.text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      return { classification: heuristic, model: "heuristic-v1" };
    }
    const parsed = postClassificationSchema.safeParse(
      JSON.parse(llm.text.slice(jsonStart, jsonEnd + 1)),
    );
    if (!parsed.success) {
      return { classification: heuristic, model: "heuristic-v1" };
    }
    return { classification: parsed.data, model: llm.modelName, llm };
  } catch {
    return { classification: heuristic, model: "heuristic-v1" };
  }
}
