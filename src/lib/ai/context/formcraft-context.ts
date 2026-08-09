import type { SupabaseClient } from "@supabase/supabase-js";
import { PostgresKnowledgeRetriever } from "@/lib/knowledge/retrieval/postgres-retriever";
import { computeWindowBaselines } from "@/lib/social/baselines";
import { freshnessMetadataForAi } from "@/lib/social/freshness";
import { CONTEXT_BUDGETS } from "@/lib/ai/models/types";
import type { ContextTaskType, ModelTier } from "@/lib/ai/models/types";
import { resolveTaskModel } from "@/lib/ai/models/preferences";
import { estimateTokens } from "@/lib/ai/models/estimate-tokens";

export type ContextSourceType =
  | "current_entity"
  | "explicit_source"
  | "my_content"
  | "performance"
  | "experiment"
  | "performance_lesson"
  | "audience_insight"
  | "audience_comment"
  | "roadmap"
  | "knowledge_document"
  | "brand_brain"
  | "analysis"
  | "draft_or_idea";

export type ProvenanceItem = {
  sourceType: ContextSourceType;
  sourceId: string;
  title: string;
  relevanceScore: number;
  excerpt: string;
};

export type FormCraftContextItem = ProvenanceItem & {
  content: string;
  priority: number;
  metadata?: Record<string, unknown>;
};

export type FormCraftContext = {
  taskType: ContextTaskType;
  modelTier: ModelTier;
  modelName: string;
  items: FormCraftContextItem[];
  provenance: ProvenanceItem[];
  usedFrom: string[];
  estimatedTokens: number;
  budgetTokens: number;
  excluded: Array<{ title: string; reason: string }>;
  debug: {
    candidatesRetrieved: number;
    afterDedupe: number;
    afterBudget: number;
  };
};

export type FormCraftContextBuilderInput = {
  userId: string;
  taskType: ContextTaskType;
  currentEntityType?: string;
  currentEntityId?: string;
  projectId?: string;
  explicitSourceIds?: string[];
  maxTokens?: number;
  query?: string;
  preferPremium?: boolean;
};

type Candidate = FormCraftContextItem;

/** Exported for unit tests and ranking diagnostics. */
export function scoreText(query: string | undefined, text: string): number {
  if (!query?.trim()) return 0.5;
  const q = query.toLowerCase().split(/\W+/).filter(Boolean);
  const hay = text.toLowerCase();
  if (q.length === 0) return 0.5;
  let hits = 0;
  for (const term of q) {
    if (hay.includes(term)) hits += 1;
  }
  return Math.min(1, 0.35 + hits / q.length);
}

/** Exported for unit tests — trims ranked candidates to a token budget. */
export function trimToBudget(
  items: Candidate[],
  budget: number,
): { kept: Candidate[]; excluded: FormCraftContext["excluded"] } {
  const kept: Candidate[] = [];
  const excluded: FormCraftContext["excluded"] = [];
  let used = 0;
  for (const item of items) {
    const cost = estimateTokens(`${item.title}\n${item.content}`);
    if (used + cost > budget && kept.length > 0) {
      excluded.push({ title: item.title, reason: "over_budget" });
      continue;
    }
    kept.push(item);
    used += cost;
  }
  return { kept, excluded };
}

/**
 * Unified FormCraft context builder.
 * Retrieves, ranks, dedupes, and budgets context by task — never dumps all user data.
 */
export async function buildFormCraftContext(
  supabase: SupabaseClient,
  input: FormCraftContextBuilderInput,
): Promise<FormCraftContext> {
  const selection = await resolveTaskModel(supabase, {
    userId: input.userId,
    taskType: input.taskType,
    preferPremium: input.preferPremium,
  });
  const modelTier = selection.modelTier;
  const budget = input.maxTokens ?? CONTEXT_BUDGETS[modelTier];
  const query = input.query ?? input.taskType.replace(/_/g, " ");
  const candidates: Candidate[] = [];

  // 1. Current object
  if (input.currentEntityType && input.currentEntityId) {
    const current = await loadCurrentEntity(
      supabase,
      input.userId,
      input.currentEntityType,
      input.currentEntityId,
    );
    if (current) candidates.push({ ...current, priority: 100 });
  }

  // 2. Explicit sources
  if (input.explicitSourceIds?.length) {
    const explicit = await loadExplicitPosts(
      supabase,
      input.userId,
      input.explicitSourceIds,
    );
    candidates.push(...explicit.map((c) => ({ ...c, priority: 95 })));
  }

  // 3–4. Recent My Content + performance
  const { data: posts } = await supabase
    .from("content_posts")
    .select(
      "id, title, caption, platform, format, topic, content_pillar, hook_text, views, likes, comments, shares, saves, relative_performance, published_at, metrics_refreshed_at, is_winner, needs_review, source, classification",
    )
    .eq("user_id", input.userId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(30);

  const baselines = computeWindowBaselines(
    (posts ?? []).map((p) => ({
      id: p.id,
      published_at: p.published_at,
      views: p.views,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      saves: p.saves,
      followers_gained: null,
    })),
    "last_30",
  );

  for (const post of posts ?? []) {
    const text = [post.title, post.caption, post.topic, post.hook_text]
      .filter(Boolean)
      .join("\n");
    const relevance = scoreText(query, text);
    if (relevance < 0.35 && !post.is_winner) continue;
    candidates.push({
      sourceType: "my_content",
      sourceId: post.id,
      title: post.title || post.caption?.slice(0, 60) || "Untitled post",
      relevanceScore: relevance + (post.is_winner ? 0.15 : 0),
      excerpt: (post.caption ?? "").slice(0, 220),
      content: [
        `Platform: ${post.platform}`,
        `Format: ${post.format ?? "unknown"}`,
        `Views: ${post.views ?? "unavailable"}`,
        `Relative: ${JSON.stringify(post.relative_performance ?? {})}`,
        post.caption ?? "",
      ].join("\n"),
      priority: 80,
      metadata: freshnessMetadataForAi({
        lastSuccessfulSyncAt: post.metrics_refreshed_at,
        metricsRefreshedAt: post.metrics_refreshed_at,
        connectionStatus: post.source === "connected_account" ? "connected" : "manual",
      }),
    });
  }

  candidates.push({
    sourceType: "performance",
    sourceId: "baseline:last_30",
    title: "Personal baseline (last 30)",
    relevanceScore: 0.7,
    excerpt: `Sample ${baselines.sampleSize}`,
    content: JSON.stringify(baselines.medians),
    priority: 75,
  });

  // 5. Active experiments
  const { data: experiments } = await supabase
    .from("content_experiments")
    .select("id, hypothesis, primary_variable, primary_metric, status, post_ids, metrics")
    .eq("user_id", input.userId)
    .in("status", ["planned", "running"])
    .limit(10);

  for (const experiment of experiments ?? []) {
    const relevance = scoreText(
      query,
      `${experiment.hypothesis} ${experiment.primary_variable ?? ""}`,
    );
    candidates.push({
      sourceType: "experiment",
      sourceId: experiment.id,
      title: experiment.hypothesis.slice(0, 80),
      relevanceScore: Math.max(relevance, 0.55),
      excerpt: `Status ${experiment.status}; posts ${(experiment.post_ids as string[])?.length ?? 0}`,
      content: JSON.stringify({
        hypothesis: experiment.hypothesis,
        primary_variable: experiment.primary_variable,
        primary_metric: experiment.primary_metric,
        metrics: experiment.metrics,
        post_ids: experiment.post_ids,
      }),
      priority: 70,
    });
  }

  // 6. Confirmed / supported lessons only
  const { data: lessons } = await supabase
    .from("performance_lessons")
    .select("id, lesson, evidence, confidence, sample_size, status, lesson_type")
    .eq("user_id", input.userId)
    .in("status", ["confirmed", "supported", "testing"])
    .order("created_at", { ascending: false })
    .limit(12);

  for (const lesson of lessons ?? []) {
    if (lesson.status === "rejected" || lesson.status === "expired") continue;
    candidates.push({
      sourceType: "performance_lesson",
      sourceId: lesson.id,
      title: lesson.lesson.slice(0, 80),
      relevanceScore: scoreText(query, lesson.lesson),
      excerpt: `Status ${lesson.status}; n=${lesson.sample_size ?? 0}`,
      content: JSON.stringify(lesson),
      priority: 68,
    });
  }

  // 7. Audience insights + recent comments
  const { data: insights } = await supabase
    .from("audience_insights")
    .select("id, insight_type, summary, evidence, sample_size, confidence, status")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(12);

  for (const insight of insights ?? []) {
    candidates.push({
      sourceType: "audience_insight",
      sourceId: insight.id,
      title: insight.summary.slice(0, 80),
      relevanceScore: scoreText(query, insight.summary),
      excerpt: `${insight.insight_type} · ${insight.confidence}`,
      content: JSON.stringify(insight),
      priority: 65,
    });
  }

  const { data: comments } = await supabase
    .from("audience_comments")
    .select("id, body, source, post_id, created_at")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(20);

  for (const comment of comments ?? []) {
    const relevance = scoreText(query, comment.body);
    if (relevance < 0.4) continue;
    candidates.push({
      sourceType: "audience_comment",
      sourceId: comment.id,
      title: comment.body.slice(0, 60),
      relevanceScore: relevance,
      excerpt: comment.body.slice(0, 160),
      content: comment.body,
      priority: 60,
    });
  }

  // 8. Roadmap
  const { data: roadmaps } = await supabase
    .from("creator_roadmaps")
    .select("id, goal, current_phase, progress_pct, status, metadata")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .limit(3);

  for (const roadmap of roadmaps ?? []) {
    candidates.push({
      sourceType: "roadmap",
      sourceId: roadmap.id,
      title: roadmap.goal.slice(0, 80),
      relevanceScore: 0.65,
      excerpt: `Phase ${roadmap.current_phase}; ${roadmap.progress_pct}%`,
      content: JSON.stringify(roadmap),
      priority: 58,
    });
  }

  // 9. Teach FormCraft knowledge
  const retriever = new PostgresKnowledgeRetriever(supabase);
  const knowledge = await retriever.retrieve({
    userId: input.userId,
    query,
    limit: 6,
  });
  for (const item of knowledge) {
    candidates.push({
      sourceType: "knowledge_document",
      sourceId: item.provenance.sourceId,
      title: item.title,
      relevanceScore: 0.7,
      excerpt: item.content.slice(0, 180),
      content: item.content,
      priority: 55,
    });
  }

  // 11. Previous analyses
  const { data: analyses } = await supabase
    .from("video_analyses")
    .select("id, title, subject_type, result, content_post_id, created_at")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(5);

  for (const analysis of analyses ?? []) {
    candidates.push({
      sourceType: "analysis",
      sourceId: analysis.id,
      title: analysis.title || "Analysis",
      relevanceScore: scoreText(query, analysis.title ?? ""),
      excerpt: `Subject ${analysis.subject_type}`,
      content: JSON.stringify(analysis.result).slice(0, 1500),
      priority: 50,
    });
  }

  // Rank: priority then relevance
  candidates.sort(
    (a, b) => b.priority - a.priority || b.relevanceScore - a.relevanceScore,
  );

  // Dedupe by sourceType+sourceId
  const seen = new Set<string>();
  const deduped: Candidate[] = [];
  for (const item of candidates) {
    const key = `${item.sourceType}:${item.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  const { kept, excluded } = trimToBudget(deduped, budget);
  const estimatedTokens = kept.reduce(
    (sum, item) => sum + estimateTokens(`${item.title}\n${item.content}`),
    0,
  );

  const provenance = kept.map(
    ({ sourceType, sourceId, title, relevanceScore, excerpt }) => ({
      sourceType,
      sourceId,
      title,
      relevanceScore,
      excerpt,
    }),
  );

  const usedFrom = summarizeUsedFrom(kept);

  return {
    taskType: input.taskType,
    modelTier,
    modelName: selection.modelName,
    items: kept,
    provenance,
    usedFrom,
    estimatedTokens,
    budgetTokens: budget,
    excluded,
    debug: {
      candidatesRetrieved: candidates.length,
      afterDedupe: deduped.length,
      afterBudget: kept.length,
    },
  };
}

function summarizeUsedFrom(items: Candidate[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label =
      item.sourceType === "my_content"
        ? "My Content posts"
        : item.sourceType === "performance_lesson"
          ? "performance lessons"
          : item.sourceType === "audience_comment"
            ? "audience comments"
            : item.sourceType === "audience_insight"
              ? "audience insights"
              : item.sourceType === "experiment"
                ? "experiments"
                : item.sourceType === "knowledge_document"
                  ? "Teach FormCraft documents"
                  : item.sourceType === "roadmap"
                    ? "roadmap"
                    : item.sourceType === "analysis"
                      ? "analyses"
                      : item.sourceType;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, n]) =>
    n === 1 ? `1 ${label.replace(/s$/, "")}` : `${n} ${label}`,
  );
}

async function loadCurrentEntity(
  supabase: SupabaseClient,
  userId: string,
  entityType: string,
  entityId: string,
): Promise<Candidate | null> {
  if (entityType === "content_post") {
    const { data } = await supabase
      .from("content_posts")
      .select("id, title, caption, platform, relative_performance, views")
      .eq("user_id", userId)
      .eq("id", entityId)
      .maybeSingle();
    if (!data) return null;
    return {
      sourceType: "current_entity",
      sourceId: data.id,
      title: data.title || "Current post",
      relevanceScore: 1,
      excerpt: (data.caption ?? "").slice(0, 180),
      content: JSON.stringify(data),
      priority: 100,
    };
  }
  if (entityType === "idea_gate") {
    const { data } = await supabase
      .from("idea_gate_evaluations")
      .select("id, idea_text, recommendation, why")
      .eq("user_id", userId)
      .eq("id", entityId)
      .maybeSingle();
    if (!data) return null;
    return {
      sourceType: "current_entity",
      sourceId: data.id,
      title: "Current idea",
      relevanceScore: 1,
      excerpt: data.idea_text.slice(0, 180),
      content: JSON.stringify(data),
      priority: 100,
    };
  }
  return null;
}

async function loadExplicitPosts(
  supabase: SupabaseClient,
  userId: string,
  ids: string[],
): Promise<Candidate[]> {
  const { data } = await supabase
    .from("content_posts")
    .select("id, title, caption, platform, views, relative_performance")
    .eq("user_id", userId)
    .in("id", ids);
  return (data ?? []).map((post) => ({
    sourceType: "explicit_source" as const,
    sourceId: post.id,
    title: post.title || "Selected post",
    relevanceScore: 1,
    excerpt: (post.caption ?? "").slice(0, 180),
    content: JSON.stringify(post),
    priority: 95,
  }));
}

/** Serialize context for LLM prompts — never includes tokens/credentials. */
export function contextToPromptBlock(ctx: FormCraftContext): string {
  const parts = ctx.items.map(
    (item, i) =>
      `[${i + 1}] (${item.sourceType}) ${item.title}\n${item.content}`,
  );
  return [
    `Task: ${ctx.taskType}`,
    `Estimated tokens: ${ctx.estimatedTokens}/${ctx.budgetTokens}`,
    `Sources used: ${ctx.usedFrom.join("; ") || "none"}`,
    "",
    ...parts,
  ].join("\n\n");
}
