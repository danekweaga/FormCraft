import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";
import {
  acceptRepurposingOpportunityAction,
  createSeriesAction,
  deleteSeriesAction,
  dismissRepurposingOpportunityAction,
  refreshRepurposingOpportunitiesAction,
  updateSeriesItemStatusAction,
} from "./actions";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";

type PageProps = { searchParams: Promise<{ error?: string; scanned?: string }> };

export default async function SeriesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [opportunities, seriesResult, postsResult] = await Promise.all([
    supabase
      .from("repurposing_opportunities")
      .select("id, title, reason, evidence, recommendation, opportunity_type, status, output_canvas_node_id, created_at")
      .eq("user_id", user.id)
      .in("status", ["suggested", "accepted", "not_worth"])
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("content_series")
      .select("id, name, thesis, format, status, created_at, content_series_items(id, ordinal, title, angle, status)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("content_posts")
      .select("id, title, caption")
      .eq("user_id", user.id)
      .order("published_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Repurpose + Series"
        description="Turn proven work into evidence-backed remakes, follow-ups, and repeatable series. Weak sources are labeled Not Worth Repurposing."
        actions={
          <form action={refreshRepurposingOpportunitiesAction}>
            <Button type="submit">Scan my content</Button>
          </form>
        }
      />

      {params.error ? <p className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">{params.error}</p> : null}
      {params.scanned ? <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">Evaluated {params.scanned} post/opportunity combinations.</p> : null}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-headline text-2xl font-semibold">Opportunity queue</h2>
            <p className="text-sm text-secondary">Every suggestion shows the metric evidence used. Accepting sends it to Canvas.</p>
          </div>
        </div>
        {(opportunities.data?.length ?? 0) === 0 ? (
          <Card><CardContent className="pt-6 text-sm text-secondary">No opportunities yet. Sync My Content, then run the scan.</CardContent></Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {opportunities.data?.map((item) => {
              const evidence = Array.isArray(item.evidence) ? item.evidence.filter((entry): entry is string => typeof entry === "string") : [];
              return (
                <Card key={item.id} className={item.status === "not_worth" ? "border-outline-variant/20 opacity-80" : ""}>
                  <CardHeader>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={item.status === "not_worth" ? "default" : "primary"}>{item.status === "not_worth" ? "Not worth repurposing" : item.opportunity_type.replaceAll("_", " ")}</Badge>
                      {item.status === "accepted" ? <Badge variant="default">On Canvas</Badge> : null}
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <CardDescription>{item.reason}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-1 text-sm text-secondary">
                      {evidence.map((entry) => <li key={entry}>• {entry}</li>)}
                    </ul>
                    {item.status === "suggested" ? (
                      <div className="flex gap-2">
                        <form action={acceptRepurposingOpportunityAction}>
                          <input type="hidden" name="opportunityId" value={item.id} />
                          <Button type="submit" size="sm">Create on Canvas</Button>
                        </form>
                        <form action={dismissRepurposingOpportunityAction}>
                          <input type="hidden" name="opportunityId" value={item.id} />
                          <Button type="submit" variant="ghost" size="sm">Dismiss</Button>
                        </form>
                      </div>
                    ) : item.output_canvas_node_id ? (
                      <Button asChild size="sm" variant="outline"><Link href="/canvas">Open Canvas</Link></Button>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Plan a series</CardTitle><CardDescription>Create a five-part structure. These are planning slots, not invented performance predictions.</CardDescription></CardHeader>
          <CardContent>
            <form action={createSeriesAction} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="series-name">Series name</Label><Input id="series-name" name="name" required placeholder="Build better student projects" /></div>
              <div className="space-y-2"><Label htmlFor="series-thesis">Thesis</Label><Textarea id="series-thesis" name="thesis" required placeholder="What repeated promise ties every episode together?" /></div>
              <div className="space-y-2"><Label htmlFor="series-format">Format</Label><Input id="series-format" name="format" placeholder="Tutorial, breakdown, case study…" /></div>
              <div className="space-y-2">
                <Label htmlFor="source-post">Optional proven source</Label>
                <select id="source-post" name="sourcePostId" className="h-10 w-full rounded-lg border border-outline bg-surface px-3 text-sm">
                  <option value="">No source post</option>
                  {postsResult.data?.map((post) => <option key={post.id} value={post.id}>{post.title || post.caption?.slice(0, 70) || "Untitled post"}</option>)}
                </select>
              </div>
              <Button type="submit">Create five-part series</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="font-headline text-2xl font-semibold">Series workspace</h2>
          {(seriesResult.data?.length ?? 0) === 0 ? <Card><CardContent className="pt-6 text-sm text-secondary">No series planned yet.</CardContent></Card> : seriesResult.data?.map((series) => (
            <Card key={series.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2"><Badge variant="primary">{series.status}</Badge>{series.format ? <Badge variant="default">{series.format}</Badge> : null}</div>
                  <form action={deleteSeriesAction}>
                    <input type="hidden" name="id" value={series.id} />
                    <ConfirmDeleteButton confirmMessage="Delete this series and all of its parts permanently?" />
                  </form>
                </div>
                <CardTitle>{series.name}</CardTitle><CardDescription>{series.thesis}</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {[...(series.content_series_items ?? [])].sort((a, b) => a.ordinal - b.ordinal).map((item) => (
                    <li key={item.id} className="rounded-lg border border-outline-variant/15 p-3">
                      <div className="flex items-center justify-between gap-3"><p className="font-medium">{item.ordinal}. {item.title}</p><form action={updateSeriesItemStatusAction} className="flex items-center gap-2"><input type="hidden" name="itemId" value={item.id} /><select name="status" defaultValue={item.status} aria-label={`Status for ${item.title}`} className="h-8 rounded-lg border border-outline bg-surface px-2 text-xs">{["idea", "scripted", "ready", "published", "skipped"].map((status) => <option key={status} value={status}>{status}</option>)}</select><Button type="submit" size="sm" variant="ghost">Update</Button></form></div>
                      {item.angle ? <p className="mt-1 text-sm text-secondary">{item.angle}</p> : null}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
