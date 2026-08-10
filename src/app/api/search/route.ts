import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SearchResult = {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  href: string;
};

function patternFor(value: string): string {
  const cleaned = value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s@#'&+\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? `%${cleaned}%` : "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pattern = patternFor(query);
  if (!pattern) return NextResponse.json({ results: [] });

  const [creators, research, posts, ideas, analyses, knowledge, psychology, canvas] = await Promise.all([
    supabase
      .from("external_creators")
      .select("id, handle, display_name, platform")
      .eq("user_id", user.id)
      .or(`handle.ilike.${pattern},display_name.ilike.${pattern}`)
      .limit(6),
    supabase
      .from("research_items")
      .select("id, title, hook_text, creator_name, platform")
      .eq("user_id", user.id)
      .eq("hidden", false)
      .or(`title.ilike.${pattern},hook_text.ilike.${pattern},creator_name.ilike.${pattern}`)
      .limit(6),
    supabase
      .from("content_posts")
      .select("id, title, caption, platform")
      .eq("user_id", user.id)
      .or(`title.ilike.${pattern},caption.ilike.${pattern},hook_text.ilike.${pattern}`)
      .limit(6),
    supabase
      .from("idea_gate_evaluations")
      .select("id, idea_text, recommendation")
      .eq("user_id", user.id)
      .ilike("idea_text", pattern)
      .limit(5),
    supabase
      .from("video_analyses")
      .select("id, title, source_type")
      .eq("user_id", user.id)
      .ilike("title", pattern)
      .limit(5),
    supabase
      .from("knowledge_documents")
      .select("id, title, knowledge_type")
      .eq("user_id", user.id)
      .ilike("title", pattern)
      .limit(5),
    supabase
      .from("psychology_principles")
      .select("id, name, evidence_strength")
      .eq("user_id", user.id)
      .ilike("name", pattern)
      .limit(5),
    supabase
      .from("canvas_nodes")
      .select("id, board_id, title, node_type")
      .eq("user_id", user.id)
      .or(`title.ilike.${pattern},body.ilike.${pattern}`)
      .limit(6),
  ]);

  const results: SearchResult[] = [
    ...(creators.data ?? []).map((row) => ({ id: `creator:${row.id}`, kind: "Creator", title: row.display_name || row.handle || "Creator", subtitle: row.platform, href: `/research/creators/${row.id}` })),
    ...(research.data ?? []).map((row) => ({ id: `research:${row.id}`, kind: "Research", title: row.title || row.hook_text || "Saved research", subtitle: [row.creator_name, row.platform].filter(Boolean).join(" · ") || null, href: `/research?mode=saved&item=${row.id}` })),
    ...(posts.data ?? []).map((row) => ({ id: `post:${row.id}`, kind: "My Content", title: row.title || row.caption?.slice(0, 80) || "Untitled post", subtitle: row.platform, href: `/my-content/${row.id}` })),
    ...(ideas.data ?? []).map((row) => ({ id: `idea:${row.id}`, kind: "Idea", title: row.idea_text.slice(0, 100), subtitle: row.recommendation, href: "/idea-gate" })),
    ...(analyses.data ?? []).map((row) => ({ id: `analysis:${row.id}`, kind: "Analysis", title: row.title || "Video analysis", subtitle: row.source_type, href: `/analyze/${row.id}` })),
    ...(knowledge.data ?? []).map((row) => ({ id: `knowledge:${row.id}`, kind: "Knowledge", title: row.title, subtitle: row.knowledge_type, href: `/knowledge/${row.id}` })),
    ...(psychology.data ?? []).map((row) => ({ id: `psychology:${row.id}`, kind: "Psychology", title: row.name, subtitle: `${row.evidence_strength} evidence`, href: `/psychology?principle=${row.id}` })),
    ...(canvas.data ?? []).map((row) => ({ id: `canvas:${row.id}`, kind: "Canvas", title: row.title, subtitle: row.node_type, href: `/canvas/${row.board_id}` })),
  ];

  return NextResponse.json({ results: results.slice(0, 30) });
}
