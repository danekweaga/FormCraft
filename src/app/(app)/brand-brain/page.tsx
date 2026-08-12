import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CONTENT_INTELLIGENCE_VERSION,
  CONTENT_SYSTEM_STAGES,
  DEFAULT_CREATOR_STARTING_POINT,
  QUALITY_GATE_DIMENSIONS,
  SOURCE_STATUS_LABELS,
  SOURCE_STATUSES,
} from "@/lib/content-intelligence/kernel";
import { createClient } from "@/lib/supabase/server";

const moduleFlow = [
  {
    step: "1",
    title: "Define what only you can say",
    description: "Your promise, audience, point of view, voice, boundaries, and proof standards become high-priority AI context.",
    href: "/persona",
    action: "Edit Creator Profile",
  },
  {
    step: "2",
    title: "Find mechanisms, not scripts to copy",
    description: "Discover extracts the audience, topic, format, hook mechanism, proof, story, and transferable pattern from outliers.",
    href: "/research?mode=outliers",
    action: "Open Discover",
  },
  {
    step: "3",
    title: "Gate the idea before spending time",
    description: "FormCraft checks audience relevance, brand fit, originality, proof, formats, hook angles, effort, conversion fit, and risk.",
    href: "/idea-gate",
    action: "Use Idea Gate",
  },
  {
    step: "4",
    title: "Build an original content package",
    description: "Build routes the format, aligns text, spoken, and visual hooks, plans progression and proof, fulfills the payoff, and matches the CTA to the objective.",
    href: "/create",
    action: "Build content",
  },
  {
    step: "5",
    title: "Verify before you publish",
    description: "The quality gate returns Ready, Revise, Rethink, or Verify and flags unsupported claims instead of inventing authority or results.",
    href: "/pre-publish",
    action: "Run Pre-Publish",
  },
  {
    step: "6",
    title: "Turn results into the next decision",
    description: "Analyze diagnoses the weakest stage. Experiments change one variable. Performance promotes repeated evidence into lessons, then feeds the next idea.",
    href: "/performance",
    action: "Review learning",
  },
];

export default async function BrandBrainPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, knowledge, lessons, experiments] = await Promise.all([
    supabase
      .from("profiles")
      .select("what_i_make, my_audience, content_style, script_style")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("knowledge_documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("performance_lessons").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["testing", "supported", "confirmed"]),
    supabase.from("content_experiments").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["planned", "running"]),
  ]);

  const profileFields = [profile?.what_i_make, profile?.my_audience, profile?.content_style, profile?.script_style];
  const completedFields = profileFields.filter((value) => value?.trim().length && value.trim().length >= 20).length;
  const profileReady = completedFields === 4;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Content System"
        description="How FormCraft turns who you are, what your audience needs, and real performance evidence into better content and a smarter next idea."
        actions={
          <>
            <Badge variant={profileReady ? "success" : "warning"}>
              Creator context {profileReady ? "active" : `${completedFields}/4 complete`}
            </Badge>
            <Badge variant="default">{CONTENT_INTELLIGENCE_VERSION}</Badge>
          </>
        }
      />

      <Card className="overflow-hidden border-primary-container/30 bg-surface-primary paper-shadow">
        <CardHeader>
          <CardTitle>The job FormCraft does for you</CardTitle>
          <CardDescription>
            It does not just generate scripts. It finds the weakest link in the full system, helps you fix it, and records what the result teaches you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {CONTENT_SYSTEM_STAGES.map((stage, index) => (
              <li key={stage.key} className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{String(index + 1).padStart(2, "0")}</p>
                <p className="mt-1 text-sm font-semibold text-on-background">{stage.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-secondary">{stage.question}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <section>
        <div className="mb-4">
          <h2 className="font-headline text-2xl font-semibold text-on-background">Your content workflow</h2>
          <p className="mt-1 text-sm text-secondary">Each step passes structured context and evidence to the next one.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {moduleFlow.map((module) => (
            <Card key={module.step} className="flex h-full flex-col bg-surface-primary paper-shadow">
              <CardHeader>
                <Badge variant="primary" className="w-fit">Step {module.step}</Badge>
                <CardTitle className="pt-2">{module.title}</CardTitle>
                <CardDescription className="leading-relaxed">{module.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild variant="outline" className="w-full">
                  <Link href={module.href}>{module.action}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-surface-primary paper-shadow">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Your current creator direction</CardTitle>
                <CardDescription>Saved profile text wins over the starter direction below.</CardDescription>
              </div>
              <Badge variant={profileReady ? "success" : "warning"}>{profileReady ? "Personalized" : "Starter context"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ["Promise", profile?.what_i_make || DEFAULT_CREATOR_STARTING_POINT.promise],
              ["Audience", profile?.my_audience || DEFAULT_CREATOR_STARTING_POINT.audience],
              ["Point of view", profile?.content_style || DEFAULT_CREATOR_STARTING_POINT.pointOfView],
              ["Proof rule", DEFAULT_CREATOR_STARTING_POINT.proofRule],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-surface-container-lowest p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{label}</p>
                <p className="mt-2 text-sm leading-relaxed text-on-background">{value}</p>
              </div>
            ))}
            <Button asChild><Link href="/persona">Personalize this</Link></Button>
          </CardContent>
        </Card>

        <Card className="bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Evidence FormCraft can use</CardTitle>
            <CardDescription>FormCraft keeps facts, frameworks, claims, feedback, observations, and its own synthesis distinct.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Taught docs", knowledge.count ?? 0],
                ["Live lessons", lessons.count ?? 0],
                ["Active tests", experiments.count ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-surface-container-lowest p-3 text-center">
                  <p className="font-headline text-2xl font-semibold text-on-background">{value}</p>
                  <p className="mt-1 text-xs text-secondary">{label}</p>
                </div>
              ))}
            </div>
            <ul className="space-y-2">
              {SOURCE_STATUSES.map((status) => (
                <li key={status} className="flex items-center justify-between gap-4 rounded-lg border border-outline-variant/15 px-3 py-2">
                  <span className="text-sm text-on-background">{SOURCE_STATUS_LABELS[status]}</span>
                  <code className="text-[10px] text-secondary">{status}</code>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-secondary">
              When sources disagree, FormCraft shows the disagreement, extracts the shared principle, explains when each may apply, and suggests a one-variable test.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-surface-primary paper-shadow">
        <CardHeader>
          <CardTitle>The 14-part quality gate</CardTitle>
          <CardDescription>Every serious draft is judged as Ready, Revise, Rethink, or Verify.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {QUALITY_GATE_DIMENSIONS.map((dimension, index) => (
              <li key={dimension} className="flex gap-3 rounded-lg bg-surface-container-lowest p-3 text-sm text-on-background">
                <span className="font-semibold text-primary">{index + 1}</span>
                <span>{dimension}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
