import type { SupabaseClient } from "@supabase/supabase-js";
import { SAMPLE_GUARDS } from "./sample-guards";

export type BottleneckResult = {
  bottleneck: string;
  evidence: string[];
  recommendation: string;
  confidence: "low" | "medium" | "high";
};

export async function detectRoadmapBottleneck(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<BottleneckResult> {
  const supabase = params.supabase;
  const userId = params.userId;

  const [{ count: postsWeek }, { count: ideas }, { data: experiments }, { data: lessons }, { data: roadmap }] =
    await Promise.all([
      supabase
        .from("content_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte(
          "published_at",
          new Date(Date.now() - 7 * 86_400_000).toISOString(),
        ),
      supabase
        .from("idea_gate_evaluations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", ["draft", "evaluated"]),
      supabase
        .from("content_experiments")
        .select("id, status, post_ids")
        .eq("user_id", userId)
        .eq("status", "running"),
      supabase
        .from("performance_lessons")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["confirmed", "supported"]),
      supabase
        .from("creator_roadmaps")
        .select("id, goal, metadata")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);

  const ideaCount = ideas ?? 0;
  const publishedThisWeek = postsWeek ?? 0;
  const running = experiments ?? [];
  const thinExperiments = running.filter(
    (e) => ((e.post_ids as string[]) ?? []).length < 3,
  );

  // Execution bottleneck
  if (
    ideaCount >= SAMPLE_GUARDS.backlogIdeasThreshold &&
    publishedThisWeek <= 2
  ) {
    return {
      bottleneck: "Execution",
      evidence: [
        `${ideaCount} saved/evaluated ideas`,
        `${publishedThisWeek} posts published this week`,
        "Weekly capacity target assumed: 5",
      ],
      recommendation:
        "Stop generating new ideas until three existing ideas are drafted and published.",
      confidence: "high",
    };
  }

  if (running.length === 0 && (lessons?.length ?? 0) > 0) {
    return {
      bottleneck: "Lack of experimentation",
      evidence: [
        `${lessons?.length ?? 0} confirmed lessons`,
        "No running experiments",
      ],
      recommendation:
        "Convert one confirmed lesson into a controlled experiment with clear variants.",
      confidence: "medium",
    };
  }

  if (thinExperiments.length > 0) {
    return {
      bottleneck: "Incomplete experiments",
      evidence: [
        `${thinExperiments.length} running experiment(s) under-sampled`,
        `${publishedThisWeek} posts this week`,
      ],
      recommendation:
        "Publish the next post into an active experiment variant before starting new ideas.",
      confidence: "medium",
    };
  }

  if (publishedThisWeek === 0) {
    return {
      bottleneck: "Low publishing volume",
      evidence: ["0 posts published in the last 7 days"],
      recommendation:
        roadmap?.goal
          ? `Ship one post aligned to: ${roadmap.goal}`
          : "Publish one piece this week to restore signal for baselines.",
      confidence: "medium",
    };
  }

  return {
    bottleneck: "None critical",
    evidence: [
      `${publishedThisWeek} posts this week`,
      `${ideaCount} ideas in gate`,
      `${running.length} running experiments`,
    ],
    recommendation: "Maintain cadence and review winners for follow-ups.",
    confidence: "low",
  };
}
