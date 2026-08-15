import type { SupabaseClient } from "@supabase/supabase-js";
import {
  confidenceFromSample,
  hasEnoughForComparison,
  SAMPLE_GUARDS,
} from "./sample-guards";

type PostRow = {
  id: string;
  caption: string | null;
  title: string | null;
  views: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  is_winner: boolean | null;
  format: string | null;
  classification: Record<string, unknown> | null;
  relative_performance: Record<string, unknown> | null;
};

export type LessonGenerationResult = {
  created: number;
  reasons: string[];
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function relativeViews(post: PostRow): number | null {
  const raw = post.relative_performance?.views_multiplier;
  if (typeof raw === "string") {
    const match = raw.match(/([\d.]+)×/);
    if (match) return Number(match[1]);
  }
  return null;
}

function groupKey(post: PostRow): string {
  const c = post.classification ?? {};
  if (c.personal_story_presence === true) return "personal_story";
  if (c.content_mode === "educational" || c.content_mode === "opinion") {
    return String(c.content_mode);
  }
  if (typeof c.hook_type === "string" && c.hook_type !== "other") {
    return `hook:${c.hook_type}`;
  }
  return "other";
}

async function insertLessonIfNew(params: {
  supabase: SupabaseClient;
  userId: string;
  lesson: string;
  lessonType: string;
  sampleSize: number;
  confidence: number;
  evidence: Record<string, unknown>;
  postIds?: string[];
  /** When true, STANDARD AI may polish the lesson wording from evidence. */
  interpretWithAi?: boolean;
}): Promise<boolean> {
  let lessonText = params.lesson;
  let evidence = params.evidence;

  if (params.interpretWithAi) {
    const { interpretLessonEvidence } = await import("./lesson-interpret");
    const interpreted = await interpretLessonEvidence({
      supabase: params.supabase,
      userId: params.userId,
      draftLesson: params.lesson,
      lessonType: params.lessonType,
      evidence: params.evidence,
      sampleSize: params.sampleSize,
    });
    lessonText = interpreted.lesson;
    evidence = {
      ...params.evidence,
      ai_summary: interpreted.summary,
      ai_confidence_label: interpreted.confidenceLabel,
      contradictory_note: interpreted.contradictoryNote,
      interpreted_with_llm: interpreted.usedLlm,
    };
  }

  const { data: existing } = await params.supabase
    .from("performance_lessons")
    .select("id")
    .eq("user_id", params.userId)
    .eq("lesson", lessonText)
    .in("status", ["suggested", "testing", "confirmed", "supported"])
    .maybeSingle();
  if (existing) return false;

  const { error } = await params.supabase.from("performance_lessons").insert({
    user_id: params.userId,
    lesson: lessonText,
    lesson_type: params.lessonType,
    status: "suggested",
    confidence: params.confidence,
    sample_size: params.sampleSize,
    evidence,
    evidence_window: { post_ids: params.postIds ?? [] },
  });
  if (error) throw new Error(error.message);
  return true;
}

/**
 * Deterministic suggested lessons from aggregate performance.
 * Never marks Supported from a single post.
 */
export async function generateSuggestedLessons(params: {
  supabase: SupabaseClient;
  userId: string;
  /** When false, skip LLM polish on lesson wording (faster intelligence pass). */
  interpretWithAi?: boolean;
}): Promise<LessonGenerationResult> {
  const polishAi = params.interpretWithAi !== false;
  const reasons: string[] = [];
  const { data: posts, error } = await params.supabase
    .from("content_posts")
    .select(
      "id, caption, title, views, comments, shares, saves, is_winner, format, classification, relative_performance",
    )
    .eq("user_id", params.userId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(90);

  if (error) throw new Error(error.message);

  const rows = (posts ?? []) as PostRow[];
  const withViews = rows.filter((p) => typeof p.views === "number");
  if (withViews.length < 3) {
    return {
      created: 0,
      reasons: [
        `Need at least 3 posts with views (have ${withViews.length}). Sync Instagram or add manual metrics.`,
      ],
    };
  }

  const groups = new Map<string, PostRow[]>();
  for (const post of rows) {
    const key = groupKey(post);
    const list = groups.get(key) ?? [];
    list.push(post);
    groups.set(key, list);
  }

  let created = 0;

  // Always-useful baseline lesson once enough metric history exists
  if (withViews.length >= SAMPLE_GUARDS.performanceLessonMinPosts) {
    const medViews = median(withViews.map((p) => p.views as number));
    const medComments = median(
      withViews
        .map((p) => p.comments)
        .filter((v): v is number => typeof v === "number"),
    );
    const lesson = `Your current personal baseline is about ${medViews?.toLocaleString() ?? "n/a"} median views across ${withViews.length} posts.`;
    const inserted = await insertLessonIfNew({
      supabase: params.supabase,
      userId: params.userId,
      lesson,
      lessonType: "baseline",
      sampleSize: withViews.length,
      confidence: confidenceFromSample(withViews.length) === "high" ? 75 : 55,
      evidence: {
        median_views: medViews,
        median_comments: medComments,
        note: "Baseline snapshot — use as a comparison anchor, not a creative rule.",
      },
      postIds: withViews.slice(0, 30).map((p) => p.id),
    });
    if (inserted) created += 1;
    else reasons.push("Baseline lesson already exists.");
  } else {
    reasons.push(
      `Baseline lesson needs ${SAMPLE_GUARDS.performanceLessonMinPosts}+ posts with views (have ${withViews.length}).`,
    );
  }

  // Winners concentration
  const winners = rows.filter((p) => p.is_winner);
  if (winners.length >= 2 && withViews.length >= 5) {
    const hookCounts = new Map<string, number>();
    for (const w of winners) {
      const hook = String(w.classification?.hook_type ?? "unknown");
      hookCounts.set(hook, (hookCounts.get(hook) ?? 0) + 1);
    }
    const topHook = [...hookCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topHook && topHook[1] >= 2 && topHook[0] !== "unknown" && topHook[0] !== "other") {
      const lesson = `Your recent winners often use “${topHook[0]}” hooks (${topHook[1]} of ${winners.length} winners). Worth testing deliberately.`;
      const inserted = await insertLessonIfNew({
        supabase: params.supabase,
        userId: params.userId,
        lesson,
        lessonType: "winner_pattern",
        sampleSize: winners.length,
        confidence: 50,
        evidence: {
          winners: winners.length,
          hook_type: topHook[0],
          hook_count: topHook[1],
        },
        postIds: winners.map((p) => p.id),
      });
      if (inserted) created += 1;
    }
  }

  const personal = groups.get("personal_story") ?? [];
  const advice = [
    ...(groups.get("educational") ?? []),
    ...(groups.get("opinion") ?? []),
  ];

  if (
    hasEnoughForComparison(
      personal.length,
      advice.length,
      SAMPLE_GUARDS.topicComparisonMinPerGroup,
    )
  ) {
    const personalMed = median(
      personal.map(relativeViews).filter((v): v is number => v !== null),
    );
    const adviceMed = median(
      advice.map(relativeViews).filter((v): v is number => v !== null),
    );
    if (
      personalMed !== null &&
      adviceMed !== null &&
      personalMed > adviceMed * 1.15
    ) {
      const sampleSize = personal.length + advice.length;
      if (sampleSize >= SAMPLE_GUARDS.performanceLessonMinPosts) {
        const lesson =
          "Personal-story posts appear to outperform generic advice posts on relative views.";
        const inserted = await insertLessonIfNew({
          supabase: params.supabase,
          userId: params.userId,
          lesson,
          lessonType: "format_pattern",
          sampleSize,
          confidence:
            confidenceFromSample(sampleSize) === "high"
              ? 80
              : confidenceFromSample(sampleSize) === "medium"
                ? 60
                : 40,
          evidence: {
            personal_story: {
              posts: personal.length,
              median_relative_views: personalMed,
            },
            advice: {
              posts: advice.length,
              median_relative_views: adviceMed,
            },
          },
          postIds: [...personal, ...advice].map((p) => p.id),
          interpretWithAi: polishAi,
        });
        if (inserted) created += 1;
      }
    } else {
      reasons.push(
        `Personal vs advice groups exist (${personal.length}/${advice.length}) but relative-view gap is not strong enough yet.`,
      );
    }
  } else {
    reasons.push(
      `Comparative lessons need 3+ personal-story and 3+ advice/opinion posts (have ${personal.length} / ${advice.length}).`,
    );
  }

  const contrarian = groups.get("hook:contrarian") ?? [];
  const question = groups.get("hook:question") ?? [];
  if (
    hasEnoughForComparison(contrarian.length, question.length) &&
    contrarian.length + question.length >= SAMPLE_GUARDS.performanceLessonMinPosts
  ) {
    const cMed = median(
      contrarian.map(relativeViews).filter((v): v is number => v !== null),
    );
    const qMed = median(
      question.map(relativeViews).filter((v): v is number => v !== null),
    );
    if (cMed !== null && qMed !== null && cMed > qMed * 1.1) {
      const lesson =
        "Contrarian hooks appear to generate stronger relative view performance than question hooks.";
      const inserted = await insertLessonIfNew({
        supabase: params.supabase,
        userId: params.userId,
        lesson,
        lessonType: "hook_pattern",
        sampleSize: contrarian.length + question.length,
        confidence: 55,
        evidence: {
          contrarian: { posts: contrarian.length, median_relative_views: cMed },
          question: { posts: question.length, median_relative_views: qMed },
        },
        interpretWithAi: polishAi,
      });
      if (inserted) created += 1;
    }
  }

  if (created === 0 && reasons.length === 0) {
    reasons.push("No new lessons to add (patterns already suggested or evidence thin).");
  }

  return { created, reasons };
}
