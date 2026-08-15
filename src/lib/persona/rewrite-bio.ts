import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { tryStructuredAI } from "@/lib/ai/client";
import {
  buildFormCraftContext,
  contextToPromptBlock,
} from "@/lib/ai/context/formcraft-context";
import { buildSuggestedBio } from "./profile-audit";

export const bioRewriteSchema = z.object({
  observedThemes: z.array(z.string()).max(8).default([]),
  variants: z
    .array(
      z.object({
        bio: z.string().trim().min(8).max(150),
        rationale: z.string().trim().min(8).max(280),
      }),
    )
    .min(1)
    .max(3),
});

export type BioRewriteResult = z.infer<typeof bioRewriteSchema>;

export type BioRewritePost = {
  title: string | null;
  caption: string | null;
  topic: string | null;
  contentPillar: string | null;
  classification?: Record<string, unknown> | null;
  views?: number | null;
};

function themeFromPost(post: BioRewritePost): string {
  const classifiedPillar =
    typeof post.classification?.content_pillar === "string"
      ? post.classification.content_pillar
      : null;
  const classifiedTopic =
    typeof post.classification?.topic === "string"
      ? post.classification.topic
      : null;
  return (
    post.contentPillar ||
    classifiedPillar ||
    post.topic ||
    classifiedTopic ||
    null
  )?.trim() || "Unclassified";
}

function postEvidenceLine(post: BioRewritePost): string {
  const theme = themeFromPost(post);
  const text = [post.title, post.caption]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" — ")
    .slice(0, 180);
  const views =
    typeof post.views === "number" && Number.isFinite(post.views)
      ? ` · ${Math.round(post.views)} views`
      : "";
  return `- [${theme}]${views} ${text || "(no caption)"}`;
}

export function countPostThemes(
  posts: BioRewritePost[],
): Array<{ name: string; posts: number }> {
  const counts = new Map<string, number>();
  for (const post of posts) {
    const theme = themeFromPost(post);
    counts.set(theme, (counts.get(theme) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, posts: count }));
}

export function postsWithUsableText(posts: BioRewritePost[]): BioRewritePost[] {
  return posts.filter((post) => {
    const text = [post.title, post.caption, post.topic, post.contentPillar]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(" ");
    return text.length >= 8;
  });
}

/** Heuristic fallback when the model is unavailable. */
export function heuristicBioRewrite(params: {
  whatIMake: string;
  audience: string;
  pillars: string[];
  currentBio: string;
  posts: BioRewritePost[];
}): BioRewriteResult {
  const themes = countPostThemes(params.posts)
    .filter((theme) => theme.name !== "Unclassified")
    .slice(0, 5);
  const themeNames = themes.map((theme) => theme.name);
  const fromPosts = themeNames.slice(0, 3).join(" · ");
  const strategy = buildSuggestedBio({
    whatIMake: params.whatIMake,
    audience: params.audience,
    pillars: params.pillars.length > 0 ? params.pillars : themeNames,
  });

  const variants: BioRewriteResult["variants"] = [];
  if (fromPosts) {
    const audienceBit = params.audience.trim().split(/\s+/).slice(0, 6).join(" ");
    let bio = audienceBit
      ? `${fromPosts}\nFor ${audienceBit}`.slice(0, 150)
      : fromPosts.slice(0, 150);
    variants.push({
      bio,
      rationale:
        "Built from the themes that show up most often in your recent owned posts.",
    });
  }
  if (strategy && strategy !== variants[0]?.bio) {
    variants.push({
      bio: strategy.slice(0, 150),
      rationale:
        "Combines your saved strategy with the pillars inferred from recent posts.",
    });
  }
  if (variants.length === 0 && params.currentBio.trim()) {
    variants.push({
      bio: params.currentBio.trim().slice(0, 150),
      rationale: "Kept your current bio; not enough post text to invent a rewrite.",
    });
  }
  if (variants.length === 0) {
    variants.push({
      bio: "I share practical posts from what I actually make.",
      rationale: "Minimal fallback until more owned posts are available.",
    });
  }

  return {
    observedThemes: themeNames,
    variants: variants.slice(0, 3),
  };
}

export async function rewriteBioFromPosts(params: {
  supabase: SupabaseClient;
  userId: string;
  whatIMake: string;
  audience: string;
  pillars: string[];
  currentBio: string;
  posts: BioRewritePost[];
}): Promise<{ result: BioRewriteResult; usedLlm: boolean }> {
  const usable = postsWithUsableText(params.posts).slice(0, 40);
  const fallback = heuristicBioRewrite({
    whatIMake: params.whatIMake,
    audience: params.audience,
    pillars: params.pillars,
    currentBio: params.currentBio,
    posts: usable,
  });

  if (usable.length < 3) {
    return { result: fallback, usedLlm: false };
  }

  const context = await buildFormCraftContext(params.supabase, {
    userId: params.userId,
    taskType: "idea_generation",
    query: "creator bio rewrite from owned posts",
  });

  const evidence = usable.slice(0, 25).map(postEvidenceLine).join("\n");
  const themes = countPostThemes(usable)
    .slice(0, 6)
    .map((theme) => `${theme.name} (${theme.posts})`)
    .join(", ");

  const ai = await tryStructuredAI({
    supabase: params.supabase,
    fallback,
    input: {
      userId: params.userId,
      taskType: "idea_generation",
      role: "standard",
      promptVersion: "bio-rewrite-from-posts-v1",
      schema: bioRewriteSchema,
      maxOutputTokens: 900,
      messages: [
        {
          role: "system",
          content: [
            "You rewrite Instagram-length creator bios from evidence of videos the creator actually posts.",
            "Rules:",
            "- Each bio must be <= 150 characters.",
            "- Reflect recurring themes in the posts, not aspirational niches they never cover.",
            "- Do not invent credentials, follower counts, job titles, or links.",
            "- Current bio is optional tone reference only.",
            "- Return 2-3 variants with short rationales.",
            "Return JSON matching the schema exactly.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            contextToPromptBlock(context),
            `Saved what I make:\n${params.whatIMake || "(empty)"}`,
            `Saved audience:\n${params.audience || "(empty)"}`,
            `Saved pillars: ${params.pillars.join(", ") || "(none)"}`,
            `Current bio:\n${params.currentBio || "(empty)"}`,
            `Observed theme counts: ${themes || "(none)"}`,
            `Recent owned posts:\n${evidence}`,
          ].join("\n\n"),
        },
      ],
    },
  });

  const clipped: BioRewriteResult = {
    observedThemes:
      ai.data.observedThemes.length > 0
        ? ai.data.observedThemes
        : fallback.observedThemes,
    variants: ai.data.variants.map((variant) => ({
      bio: variant.bio.slice(0, 150).trim(),
      rationale: variant.rationale.slice(0, 280).trim(),
    })),
  };

  return { result: clipped, usedLlm: ai.usedLlm };
}
