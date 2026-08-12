import { normalizeAnalysisResult } from "@/lib/analyze/schema";
import { getCanonicalHookTemplates } from "@/lib/hooks/starter-library";

export type HookLibraryItem = {
  id: string;
  hook: string;
  sourceKind: "starter" | "my_content" | "research" | "analysis" | "canvas";
  sourceLabel: string;
  sourceHref: string;
  researchItemId: string | null;
  platform: string;
  creator: string | null;
  topic: string | null;
  format: string | null;
  hookType: string | null;
  mechanisms: string[];
  explanation: string | null;
  assessment: string | null;
  views: number | null;
  outlierScore: number | null;
  relativePerformance: number | null;
  ratings: Array<{ category: string; rating: string; explanation: string }>;
  templateId?: string;
  requirements?: string[];
  riskFlags?: string[];
};

type PostRow = {
  id: string;
  title: string | null;
  caption: string | null;
  platform: string;
  hook_text: string | null;
  topic: string | null;
  format: string | null;
  views: number | null;
  relative_performance: unknown;
};

type ResearchRow = {
  id: string;
  title: string | null;
  platform: string;
  creator_name: string | null;
  hook_text: string | null;
  topic: string | null;
  analysis: unknown;
  outlier_score: number | null;
};

type AnalysisRow = {
  id: string;
  title: string | null;
  source_type: string | null;
  content_post_id: string | null;
  research_item_id: string | null;
  result: unknown;
};

type CanvasRow = {
  id: string;
  board_id: string;
  title: string;
  body: string | null;
  node_type: string;
  payload: unknown;
  research_item_id: string | null;
};

function relativeValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["views", "viewMultiplier", "multiplier", "overall"]) {
    const candidate = record[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }
  return null;
}

export function buildStarterHookLibrary(): HookLibraryItem[] {
  return getCanonicalHookTemplates().map((template) => ({
    id: `starter:${template.canonical_id}`,
    hook: template.template,
    sourceKind: "starter",
    sourceLabel: "FormCraft Hook + Story Script Library",
    sourceHref: "/hooks",
    researchItemId: null,
    platform: "short-form",
    creator: null,
    topic: null,
    format: null,
    hookType: template.family,
    mechanisms: template.jobs,
    explanation: template.notes.join(" ") || null,
    assessment: "Creator framework template. Test it against your own evidence; it is not a performance guarantee.",
    views: null,
    outlierScore: null,
    relativePerformance: null,
    ratings: [],
    templateId: template.canonical_id,
    requirements: template.requires,
    riskFlags: template.risk_flags,
  }));
}

export function buildHookLibrary(params: {
  posts: PostRow[];
  research: ResearchRow[];
  analyses: AnalysisRow[];
  canvas?: CanvasRow[];
}): HookLibraryItem[] {
  const posts = new Map(params.posts.map((post) => [post.id, post]));
  const research = new Map(params.research.map((item) => [item.id, item]));
  const items: HookLibraryItem[] = [];
  const seen = new Set<string>();

  for (const analysis of params.analyses) {
    const result = normalizeAnalysisResult(analysis.result);
    const post = analysis.content_post_id ? posts.get(analysis.content_post_id) : null;
    const source = analysis.research_item_id ? research.get(analysis.research_item_id) : null;
    for (const [index, hook] of result.hooks.entries()) {
      const text = hook.text.trim();
      if (!text) continue;
      const key = `${analysis.id}:${text.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `${analysis.id}:${index}`,
        hook: text,
        sourceKind: post ? "my_content" : source ? "research" : "analysis",
        sourceLabel: analysis.title || post?.title || source?.title || "Video analysis",
        sourceHref: `/analyze/${analysis.id}`,
        researchItemId: source?.id ?? null,
        platform: post?.platform || source?.platform || "unknown",
        creator: source?.creator_name ?? (post ? "My content" : null),
        topic: result.overview.topic || post?.topic || source?.topic || null,
        format: post?.format ?? null,
        hookType: hook.type || null,
        mechanisms: hook.mechanisms,
        explanation: hook.explanation || null,
        assessment: hook.assessment || hook.effectiveness || null,
        views: post?.views ?? null,
        outlierScore: source?.outlier_score ?? null,
        relativePerformance: relativeValue(post?.relative_performance),
        ratings: result.scorecard
          .filter((score) => /clarity|specific|curios|tension|stakes|target|novel|speed|open loop|hook/i.test(score.category))
          .map((score) => ({
            category: score.category,
            rating: score.rating,
            explanation: score.explanation,
          })),
      });
    }
  }

  for (const post of params.posts) {
    const text = post.hook_text?.trim();
    if (!text) continue;
    const key = `post:${post.id}:${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: `post:${post.id}`,
      hook: text,
      sourceKind: "my_content",
      sourceLabel: post.title || post.caption?.slice(0, 80) || "My content",
      sourceHref: `/my-content/${post.id}`,
      researchItemId: null,
      platform: post.platform,
      creator: "My content",
      topic: post.topic,
      format: post.format,
      hookType: null,
      mechanisms: [],
      explanation: null,
      assessment: null,
      views: post.views,
      outlierScore: null,
      relativePerformance: relativeValue(post.relative_performance),
      ratings: [],
    });
  }

  for (const source of params.research) {
    const text = source.hook_text?.trim();
    if (!text) continue;
    const key = `research:${source.id}:${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const analysis = (source.analysis ?? {}) as Record<string, unknown>;
    items.push({
      id: `research:${source.id}`,
      hook: text,
      sourceKind: "research",
      sourceLabel: source.title || text.slice(0, 80),
      sourceHref: `/research?mode=saved&item=${source.id}`,
      researchItemId: source.id,
      platform: source.platform,
      creator: source.creator_name,
      topic: source.topic,
      format: null,
      hookType: typeof analysis.hookType === "string" ? analysis.hookType : null,
      mechanisms: [],
      explanation: Array.isArray(analysis.whyItMayWork)
        ? (analysis.whyItMayWork as string[]).join(" ")
        : null,
      assessment: null,
      views: null,
      outlierScore: source.outlier_score,
      relativePerformance: null,
      ratings: [],
    });
  }

  for (const node of params.canvas ?? []) {
    const payload = node.payload && typeof node.payload === "object" ? node.payload as Record<string, unknown> : {};
    const payloadHook = [payload.hook, payload.hookText, payload.originalHook].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    const text = payloadHook?.trim() || (["external_outlier", "source_post"].includes(node.node_type) ? node.title.trim() : "");
    if (!text) continue;
    const key = `canvas:${node.id}:${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const source = node.research_item_id ? research.get(node.research_item_id) : null;
    items.push({
      id: `canvas:${node.id}`,
      hook: text,
      sourceKind: "canvas",
      sourceLabel: node.title,
      sourceHref: `/canvas/${node.board_id}`,
      researchItemId: node.research_item_id,
      platform: source?.platform || "workspace",
      creator: source?.creator_name ?? null,
      topic: source?.topic ?? null,
      format: null,
      hookType: null,
      mechanisms: [],
      explanation: node.body,
      assessment: null,
      views: null,
      outlierScore: source?.outlier_score ?? null,
      relativePerformance: null,
      ratings: [],
    });
  }

  return items.sort((a, b) => {
    const aEvidence = a.views ?? (a.outlierScore != null ? a.outlierScore * 1000 : 0);
    const bEvidence = b.views ?? (b.outlierScore != null ? b.outlierScore * 1000 : 0);
    return bEvidence - aEvidence;
  });
}
