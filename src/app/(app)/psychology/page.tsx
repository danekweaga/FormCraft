import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";
import { STARTER_PSYCHOLOGY_PRINCIPLES } from "@/lib/psychology/starter-library";
import { openAlexProvider } from "@/lib/psychology/providers/openalex";
import type { ScholarlyStudy } from "@/lib/psychology/providers/types";
import {
  addPsychologyPrincipleAction,
  addPsychologySourceAction,
  installPsychologyStarterLibraryAction,
  saveOpenAlexStudyAction,
} from "./actions";

type PageProps = {
  searchParams: Promise<{
    error?: string;
    principle?: string;
    installed?: string;
    q?: string;
    saved?: string;
  }>;
};

const sourceTypeLabels: Record<string, string> = {
  doi: "DOI",
  pubmed: "PubMed",
  semantic_scholar: "Semantic Scholar",
  crossref: "Crossref",
  core: "CORE",
  doaj: "DOAJ",
  repository: "Open repository",
  paper_upload: "Paper upload",
  research_url: "Research URL",
  book_notes: "Book notes",
};

export default async function PsychologyPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const scholarlyQuery = params.q?.trim() ?? "";
  let scholarlyStudies: ScholarlyStudy[] = [];
  let scholarlyError: string | null = null;
  if (scholarlyQuery.length >= 3 && openAlexProvider.isConfigured()) {
    try {
      scholarlyStudies = await openAlexProvider.searchStudies(scholarlyQuery, 12);
    } catch (error) {
      scholarlyError =
        error instanceof Error ? error.message : "Scholarly search failed.";
    }
  }

  const [principlesResult, sourcesResult] = await Promise.all([
    supabase
      .from("psychology_principles")
      .select("id, name, description, mechanism, content_application, limitations, evidence_strength, status, last_reviewed_at, psychology_principle_sources(source_id)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("psychology_sources")
      .select("id, source_type, title, url, doi, citation, notes, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const sourceMap = new Map((sourcesResult.data ?? []).map((source) => [source.id, source]));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Psychology Lab"
        description="Store evidence-aware behavioral principles for content strategy. FormCraft separates a claim, its mechanism, its limitations, and the sources that support it."
        actions={<form action={installPsychologyStarterLibraryAction}><Button type="submit">Install cited starter library</Button></form>}
      />

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-secondary">
        FormCraft does not bypass paywalls or treat popular advice as scientific evidence. Add lawful source links, citations, uploads, or your own notes; mark evidence strength conservatively.
      </div>
      {params.error ? <p className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">{params.error}</p> : null}
      {params.installed ? <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">Installed {params.installed} cited principles and linked their original sources.</p> : null}
      {params.saved === "openalex" ? <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">Saved the verified OpenAlex record to your source library.</p> : null}

      <section>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Discover scholarly evidence</CardTitle>
                <CardDescription>
                  Search OpenAlex, then save the canonical record before deriving a content principle.
                </CardDescription>
              </div>
              <Badge variant={openAlexProvider.isConfigured() ? "primary" : "default"}>
                {openAlexProvider.isConfigured() ? "OpenAlex connected" : "OpenAlex key required"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <form method="get" action="/psychology" className="flex flex-col gap-3 sm:flex-row">
              <Input
                name="q"
                defaultValue={scholarlyQuery}
                minLength={3}
                required
                placeholder="Search attention, curiosity, memory, persuasion..."
                aria-label="Search scholarly studies"
              />
              <Button type="submit">Search studies</Button>
            </form>

            {!openAlexProvider.isConfigured() ? (
              <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-secondary">
                Scholarly discovery is disabled until the server-only <code>OPENALEX_API_KEY</code> is added locally and in Vercel. Manual sources and the cited starter library still work.
              </p>
            ) : null}
            {scholarlyQuery.length > 0 && scholarlyQuery.length < 3 ? (
              <p className="text-sm text-secondary">Enter at least three characters.</p>
            ) : null}
            {scholarlyError ? (
              <p className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">{scholarlyError}</p>
            ) : null}
            {scholarlyQuery.length >= 3 && !scholarlyError && openAlexProvider.isConfigured() && scholarlyStudies.length === 0 ? (
              <p className="text-sm text-secondary">No studies matched this search.</p>
            ) : null}

            {scholarlyStudies.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {scholarlyStudies.map((study) => (
                  <article key={study.providerId} className="space-y-3 rounded-xl border border-outline p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="default">{study.studyType.replaceAll("_", " ")}</Badge>
                      <Badge variant="default">{study.citedByCount.toLocaleString()} citations</Badge>
                      {study.fullTextAccess === "open" ? <Badge variant="primary">Open access</Badge> : null}
                      {study.isRetracted ? <Badge variant="danger">Retracted</Badge> : null}
                    </div>
                    <div>
                      <h3 className="font-headline text-lg font-semibold">{study.title}</h3>
                      <p className="mt-1 text-xs text-secondary">
                        {[study.authors.slice(0, 4).join(", "), study.year, study.journal].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {study.abstract ? <p className="line-clamp-5 text-sm text-secondary">{study.abstract}</p> : <p className="text-sm text-secondary">Abstract unavailable from the provider.</p>}
                    {study.isRetracted ? <p className="text-sm font-medium text-error">Do not use this study as supporting evidence.</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <form action={saveOpenAlexStudyAction}>
                        <input type="hidden" name="providerId" value={study.providerId} />
                        <Button type="submit" size="sm" disabled={study.isRetracted}>Save verified source</Button>
                      </form>
                      <Button asChild variant="outline" size="sm">
                        <a href={study.sourceUrl} target="_blank" rel="noreferrer">Open original</a>
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-1 font-headline text-2xl font-semibold">FormCraft starter principles</h2>
        <p className="mb-4 text-sm text-secondary">Available immediately as a reference. “Content application” is a bounded FormCraft inference; the papers did not test social-video performance.</p>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {STARTER_PSYCHOLOGY_PRINCIPLES.map((starter) => (
            <Card key={starter.name}>
              <CardHeader><Badge variant="primary" className="w-fit">{starter.evidenceStrength} evidence</Badge><CardTitle className="text-lg">{starter.name}</CardTitle><CardDescription>{starter.description}</CardDescription></CardHeader>
              <CardContent className="space-y-3 text-sm"><div><p className="font-semibold">Use carefully</p><p className="text-secondary">{starter.contentApplication}</p></div><div><p className="font-semibold">Limits</p><p className="text-secondary">{starter.limitations}</p></div><a href={starter.source.url} target="_blank" rel="noreferrer" className="inline-block text-primary underline">{starter.source.citation}</a></CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Add a source</CardTitle><CardDescription>Record the original reference before deriving a principle.</CardDescription></CardHeader>
          <CardContent>
            <form action={addPsychologySourceAction} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="source-type">Source type</Label><select id="source-type" name="sourceType" className="h-10 w-full rounded-lg border border-outline bg-surface px-3 text-sm">{Object.entries(sourceTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="source-title">Title</Label><Input id="source-title" name="title" required /></div>
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="source-url">URL</Label><Input id="source-url" name="url" type="url" /></div><div className="space-y-2"><Label htmlFor="source-doi">DOI</Label><Input id="source-doi" name="doi" /></div></div>
              <div className="space-y-2"><Label htmlFor="citation">Citation</Label><Textarea id="citation" name="citation" /></div>
              <div className="space-y-2"><Label htmlFor="source-notes">Your notes</Label><Textarea id="source-notes" name="notes" /></div>
              <Button type="submit">Save source</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Add a principle</CardTitle><CardDescription>Convert evidence into a bounded, practical content principle.</CardDescription></CardHeader>
          <CardContent>
            <form action={addPsychologyPrincipleAction} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="principle-name">Principle</Label><Input id="principle-name" name="name" required placeholder="Curiosity gap" /></div>
              <div className="space-y-2"><Label htmlFor="principle-description">What the evidence supports</Label><Textarea id="principle-description" name="description" required /></div>
              <div className="space-y-2"><Label htmlFor="mechanism">Proposed mechanism</Label><Textarea id="mechanism" name="mechanism" /></div>
              <div className="space-y-2"><Label htmlFor="content-application">Content application</Label><Textarea id="content-application" name="contentApplication" /></div>
              <div className="space-y-2"><Label htmlFor="limitations">Limitations and counter-evidence</Label><Textarea id="limitations" name="limitations" /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="evidence-strength">Evidence strength</Label><select id="evidence-strength" name="evidenceStrength" className="h-10 w-full rounded-lg border border-outline bg-surface px-3 text-sm">{["unknown", "limited", "emerging", "moderate", "strong"].map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
                <div className="space-y-2"><Label htmlFor="principle-source">Supporting source</Label><select id="principle-source" name="sourceId" className="h-10 w-full rounded-lg border border-outline bg-surface px-3 text-sm"><option value="">No source linked yet</option>{sourcesResult.data?.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}</select></div>
              </div>
              <Button type="submit">Save principle</Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 font-headline text-2xl font-semibold">Principle library</h2>
        {(principlesResult.data?.length ?? 0) === 0 ? <Card><CardContent className="pt-6 text-sm text-secondary">No psychology principles yet. Add a source and record the first bounded claim.</CardContent></Card> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {principlesResult.data?.map((principle) => {
              const sourceIds = (principle.psychology_principle_sources ?? []).map((link) => link.source_id);
              return (
                <Card key={principle.id} className={params.principle === principle.id ? "border-primary" : ""}>
                  <CardHeader><div className="flex flex-wrap gap-2"><Badge variant="primary">{principle.evidence_strength} evidence</Badge><Badge variant="default">{principle.status}</Badge></div><CardTitle>{principle.name}</CardTitle><CardDescription>{principle.description}</CardDescription></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {principle.mechanism ? <div><p className="font-semibold">Mechanism</p><p className="text-secondary">{principle.mechanism}</p></div> : null}
                    {principle.content_application ? <div><p className="font-semibold">Apply it</p><p className="text-secondary">{principle.content_application}</p></div> : null}
                    {principle.limitations ? <div><p className="font-semibold">Limits</p><p className="text-secondary">{principle.limitations}</p></div> : null}
                    {sourceIds.length ? <div><p className="font-semibold">Sources</p><ul className="mt-1 space-y-1 text-secondary">{sourceIds.map((id) => { const source = sourceMap.get(id); return source ? <li key={id}>{source.url ? <a className="text-primary underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}</li> : null; })}</ul></div> : <p className="text-secondary">No supporting source linked yet.</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
