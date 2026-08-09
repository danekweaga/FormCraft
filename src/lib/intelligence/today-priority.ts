import type { SupabaseClient } from "@supabase/supabase-js";
import { shouldBlockIdeaGeneration } from "./backlog-guard";
import { detectRoadmapBottleneck } from "./roadmap-bottleneck";
import { SAMPLE_GUARDS } from "./sample-guards";

export type TodayPriority = {
  title: string;
  why: string[];
  href: string;
  estimatedMinutes: number | null;
  rank: number;
};

export async function buildTodayPriorities(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<TodayPriority[]> {
  const { supabase, userId } = params;
  const priorities: TodayPriority[] = [];

  const bottleneck = await detectRoadmapBottleneck({ supabase, userId });
  priorities.push({
    rank: 1,
    title: `Roadmap focus: ${bottleneck.bottleneck}`,
    why: [bottleneck.recommendation, ...bottleneck.evidence],
    href: "/roadmap",
    estimatedMinutes: 35,
  });

  const { data: running } = await supabase
    .from("content_experiments")
    .select("id, hypothesis, post_ids, status")
    .eq("user_id", userId)
    .eq("status", "running")
    .limit(5);

  for (const experiment of running ?? []) {
    const count = ((experiment.post_ids as string[]) ?? []).length;
    if (count < SAMPLE_GUARDS.experimentPostsPerVariant) {
      priorities.push({
        rank: 3,
        title: "Active experiment needs another post",
        why: [
          experiment.hypothesis,
          `${count}/${SAMPLE_GUARDS.experimentPostsPerVariant} posts attached`,
        ],
        href: "/experiments",
        estimatedMinutes: 45,
      });
      break;
    }
  }

  const [{ count: ideaCount }, { count: draftAnalyses }, { count: prePublish }] =
    await Promise.all([
      supabase
        .from("idea_gate_evaluations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", ["draft", "evaluated"]),
      supabase
        .from("video_analyses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("subject_type", "draft"),
      supabase
        .from("pre_publish_reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "reviewed"),
    ]);

  const unfinishedIdeas = ideaCount ?? 0;
  const unfinishedDrafts = (draftAnalyses ?? 0) + (prePublish ?? 0);
  const blockIdeas = shouldBlockIdeaGeneration({
    unfinishedIdeas,
    unfinishedDrafts,
  });

  if (blockIdeas || unfinishedIdeas >= SAMPLE_GUARDS.backlogIdeasThreshold) {
    priorities.push({
      rank: 2,
      title: "Execute from backlog — do not generate new ideas",
      why: [
        `${unfinishedIdeas} ideas in Idea Gate`,
        `${unfinishedDrafts} unfinished drafts / pre-publish items`,
        blockIdeas
          ? `Backlog guard active (≥${SAMPLE_GUARDS.backlogIdeasThreshold} ideas and ≥${SAMPLE_GUARDS.backlogDraftsThreshold} drafts)`
          : "Idea generation paused until execution catches up",
      ],
      href: "/idea-gate",
      estimatedMinutes: 30,
    });
  } else {
    priorities.push({
      rank: 10,
      title: "Optional: evaluate a new idea",
      why: ["Backlog is low enough that ideation is acceptable"],
      href: "/idea-gate",
      estimatedMinutes: 15,
    });
  }

  const { data: winners } = await supabase
    .from("content_posts")
    .select("id, title, caption, comments")
    .eq("user_id", userId)
    .eq("is_winner", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (winners?.[0] && (winners[0].comments ?? 0) >= 5) {
    priorities.push({
      rank: 7,
      title: "Follow-up opportunity on a winner",
      why: [
        winners[0].title || winners[0].caption?.slice(0, 60) || "Winner post",
        "High comment volume suggests a part-2 / response video",
      ],
      href: `/my-content/${winners[0].id}`,
      estimatedMinutes: 40,
    });
  }

  const { data: insights } = await supabase
    .from("audience_insights")
    .select("id, summary, insight_type")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("insight_type", "question")
    .limit(1);

  if (insights?.[0]) {
    priorities.push({
      rank: 6,
      title: "Audience opportunity",
      why: [insights[0].summary],
      href: "/audience",
      estimatedMinutes: 25,
    });
  }

  priorities.sort((a, b) => a.rank - b.rank);
  return priorities.slice(0, 5);
}

export async function recommendNextContent(params: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const priorities = await buildTodayPriorities(params);
  const bottleneck = await detectRoadmapBottleneck(params);
  const top = priorities[0];

  const { data: lessons } = await params.supabase
    .from("performance_lessons")
    .select("lesson")
    .eq("user_id", params.userId)
    .in("status", ["confirmed", "supported"])
    .limit(3);

  return {
    recommendedConcept:
      bottleneck.bottleneck === "Execution"
        ? "Ship one backlog idea this week — no new ideation"
        : top?.title ?? "Publish one post aligned to your roadmap",
    whyNow: top?.why ?? [bottleneck.recommendation],
    evidence: bottleneck.evidence,
    suggestedFormat: "short-form video",
    suggestedHookDirection:
      lessons?.[0]?.lesson?.includes("Contrarian")
        ? "Contrarian opening"
        : lessons?.[0]?.lesson?.includes("Personal-story")
          ? "Personal story in the first 15 seconds"
          : "Clear claim before explanation",
    activeExperimentRelationship: priorities.find((p) =>
      p.title.toLowerCase().includes("experiment"),
    )?.why[0] ?? null,
    estimatedEffortMinutes: top?.estimatedMinutes ?? 35,
    alternatives: priorities.slice(1, 3).map((p) => p.title),
  };
}
