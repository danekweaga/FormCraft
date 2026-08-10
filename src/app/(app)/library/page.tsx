import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const categories = [
  { key: "research", label: "Saved research", href: "/research?mode=saved", icon: "◎", description: "Outliers and references you deliberately saved." },
  { key: "hooks", label: "Hooks", href: "/hooks", icon: "↗", description: "Hooks extracted from your real posts, research, and analyses." },
  { key: "formats", label: "Formats", href: "/collections", icon: "▦", description: "Reusable format patterns with your own performance evidence." },
  { key: "analyses", label: "Analyses", href: "/analyze", icon: "◫", description: "Transcript and evidence-aware video breakdowns." },
  { key: "patterns", label: "Saved patterns", href: "/analyze", icon: "✦", description: "Reusable patterns saved from completed analyses." },
  { key: "knowledge", label: "Knowledge", href: "/knowledge", icon: "◇", description: "Sources you taught FormCraft to use in its reasoning." },
  { key: "ideas", label: "Ideas", href: "/idea-gate", icon: "☼", description: "Evaluated ideas with evidence, risk, and next actions." },
  { key: "canvas", label: "Canvas", href: "/canvas", icon: "⌘", description: "Boards linking research, patterns, ideas, scripts, and results." },
] as const;

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [research, analyses, patterns, knowledge, ideas, canvas, hookPosts, formatPosts, recentResearch, recentAnalyses, recentIdeas] = await Promise.all([
    supabase.from("research_items").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("saved", true),
    supabase.from("video_analyses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("saved_patterns").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("knowledge_documents").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_archived", false),
    supabase.from("idea_gate_evaluations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("canvas_nodes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("content_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("hook_text", "is", null),
    supabase.from("content_posts").select("format").eq("user_id", user.id).not("format", "is", null),
    supabase.from("research_items").select("id, title, hook_text, platform, creator_name, updated_at").eq("user_id", user.id).eq("saved", true).order("updated_at", { ascending: false }).limit(5),
    supabase.from("video_analyses").select("id, title, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("idea_gate_evaluations").select("id, idea_text, recommendation, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
  ]);

  const counts: Record<string, number> = {
    research: research.count ?? 0,
    hooks: (research.count ?? 0) + (hookPosts.count ?? 0),
    formats: new Set((formatPosts.data ?? []).map((row) => row.format).filter(Boolean)).size,
    analyses: analyses.count ?? 0,
    patterns: patterns.count ?? 0,
    knowledge: knowledge.count ?? 0,
    ideas: ideas.count ?? 0,
    canvas: canvas.count ?? 0,
  };
  const recent = [
    ...(recentResearch.data ?? []).map((item) => ({ id: `research-${item.id}`, kind: "Research", title: item.title || item.hook_text || "Saved research", detail: [item.creator_name, item.platform].filter(Boolean).join(" · "), href: `/create?researchItem=${item.id}`, createdAt: item.updated_at })),
    ...(recentAnalyses.data ?? []).map((item) => ({ id: `analysis-${item.id}`, kind: "Analysis", title: item.title || "Video analysis", detail: item.status, href: `/analyze/${item.id}`, createdAt: item.created_at })),
    ...(recentIdeas.data ?? []).map((item) => ({ id: `idea-${item.id}`, kind: "Idea", title: item.idea_text.slice(0, 120), detail: item.recommendation, href: "/idea-gate", createdAt: item.created_at })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  return (
    <div className="space-y-8">
      <PageHeader title="Library" description="One home for saved research, reusable evidence, analyses, ideas, and connected creative work." />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {categories.map((category) => (
          <Link key={category.key} href={category.href} className="group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Card className="h-full transition-transform group-hover:-translate-y-0.5 group-hover:border-primary/40">
              <CardHeader>
                <div className="flex items-start justify-between gap-3"><span className="text-2xl text-primary" aria-hidden>{category.icon}</span><Badge variant="default">{counts[category.key]}</Badge></div>
                <CardTitle className="text-lg">{category.label}</CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader><CardTitle>Recently active</CardTitle><CardDescription>Continue from the latest saved or generated workspace asset.</CardDescription></CardHeader>
          <CardContent>
            {recent.length === 0 ? <p className="text-sm text-secondary">Your library is empty. Save a research item or analyze a video to start it.</p> : (
              <ul className="divide-y divide-outline-variant/15">
                {recent.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="flex items-center justify-between gap-4 py-3 hover:text-primary">
                      <div className="min-w-0"><p className="truncate font-medium">{item.title}</p><p className="text-xs text-secondary">{item.kind}{item.detail ? ` · ${item.detail}` : ""}</p></div>
                      <span aria-hidden>→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Build from evidence</CardTitle><CardDescription>A library item becomes useful when it stays connected to what you create.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full"><Link href="/research">Find outliers</Link></Button>
            <Button asChild variant="outline" className="w-full"><Link href="/analyze">Analyze a video</Link></Button>
            <Button asChild variant="outline" className="w-full"><Link href="/canvas">Open Canvas</Link></Button>
            <Button asChild variant="ghost" className="w-full"><Link href="/create">Start a build</Link></Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
