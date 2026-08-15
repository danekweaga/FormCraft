import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FORMAT_LIBRARY,
  inferFormatFromEvidence,
  normalizeFormatSlug,
} from "@/lib/library/format-library";
import { createClient } from "@/lib/supabase/server";
import { FormatsShowAllToggle } from "./formats-show-all-toggle";

const familyTone: Record<string, string> = {
  "Direct-to-camera": "from-emerald-500/35 via-emerald-500/10",
  Educational: "from-blue-500/35 via-blue-500/10",
  Narrative: "from-violet-500/35 via-violet-500/10",
  Entertainment: "from-rose-500/35 via-rose-500/10",
  Visual: "from-amber-500/35 via-amber-500/10",
};

type FormatExample = {
  id: string;
  title: string;
  platform: string;
  creator: string | null;
  views: number | null;
  outlierScore: number | null;
  hookText: string | null;
  href: string;
  formatSlug: string;
};

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; q?: string; all?: string }>;
}) {
  const params = await searchParams;
  const showAll = params.all === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: researchItems }, { data: ownedPosts }] = await Promise.all([
    supabase
      .from("research_items")
      .select(
        "id, title, description, hook_text, transcript, platform, creator_name, views, outlier_score, duration_seconds, analysis, published_at, hidden, format",
      )
      .eq("user_id", user.id)
      .eq("hidden", false)
      .order("discovered_at", { ascending: false })
      .limit(400),
    supabase
      .from("content_posts")
      .select("id, title, caption, platform, format, hook_text, views, published_at")
      .eq("user_id", user.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(120),
  ]);

  // Backfill missing format on research items (cheap heuristic, no LLM).
  const backfill: Array<{ id: string; format: string }> = [];
  for (const item of researchItems ?? []) {
    if (item.format) continue;
    const format = inferFormatFromEvidence({
      title: item.title,
      description: item.description,
      hookText: item.hook_text,
      transcript: item.transcript,
      durationSeconds:
        item.duration_seconds == null ? null : Number(item.duration_seconds),
      analysis:
        item.analysis && typeof item.analysis === "object"
          ? (item.analysis as Record<string, unknown>)
          : null,
    });
    backfill.push({ id: item.id, format });
  }
  if (backfill.length > 0) {
    await Promise.all(
      backfill.slice(0, 80).map((row) =>
        supabase
          .from("research_items")
          .update({ format: row.format })
          .eq("id", row.id)
          .eq("user_id", user.id),
      ),
    );
  }
  const backfillMap = new Map(backfill.map((row) => [row.id, row.format]));

  const examples: FormatExample[] = [
    ...(researchItems ?? []).map((item) => {
      const formatSlug =
        normalizeFormatSlug(item.format) ??
        backfillMap.get(item.id) ??
        inferFormatFromEvidence({
          title: item.title,
          description: item.description,
          hookText: item.hook_text,
          transcript: item.transcript,
          durationSeconds:
            item.duration_seconds == null ? null : Number(item.duration_seconds),
          analysis:
            item.analysis && typeof item.analysis === "object"
              ? (item.analysis as Record<string, unknown>)
              : null,
        });
      return {
        id: item.id,
        title: item.title || item.hook_text || "Untitled For You video",
        platform: item.platform,
        creator: item.creator_name,
        views: item.views,
        outlierScore:
          item.outlier_score == null ? null : Number(item.outlier_score),
        hookText: item.hook_text,
        href: `/research?highlight=${item.id}`,
        formatSlug,
      };
    }),
    ...(ownedPosts ?? []).map((post) => {
      const formatSlug =
        normalizeFormatSlug(post.format) ??
        inferFormatFromEvidence({
          title: post.title,
          description: post.caption,
          hookText: post.hook_text,
        });
      return {
        id: post.id,
        title: post.title || post.caption?.slice(0, 100) || "Untitled post",
        platform: post.platform,
        creator: "You",
        views: post.views,
        outlierScore: null,
        hookText: post.hook_text,
        href: `/my-content/${post.id}`,
        formatSlug,
      };
    }),
  ];

  const query = params.q?.trim().toLowerCase() ?? "";
  const definitions = FORMAT_LIBRARY.filter((definition) =>
    !query
      ? true
      : `${definition.name} ${definition.family} ${definition.description}`
          .toLowerCase()
          .includes(query),
  );
  const withCounts = definitions.map((definition) => ({
    definition,
    matches: examples.filter((item) => item.formatSlug === definition.slug),
  }));
  const visible = showAll
    ? withCounts
    : withCounts.filter((row) => row.matches.length > 0);
  const hiddenEmpty = withCounts.length - visible.length;

  const selected =
    FORMAT_LIBRARY.find((definition) => definition.slug === params.format) ??
    null;
  const selectedExamples = selected
    ? examples.filter((item) => item.formatSlug === selected.slug)
    : [];

  return (
    <div>
      <PageHeader
        title="Formats"
        description="Formats found in your For You feed and owned posts, grouped by how the video was made (tutorial, screen recording, yap, storytime, …)."
        actions={
          <Button asChild variant="outline">
            <Link href="/research">Open For You</Link>
          </Button>
        }
      />

      <form
        action="/collections"
        method="get"
        className="mb-4 flex max-w-xl gap-2"
      >
        {showAll ? <input type="hidden" name="all" value="1" /> : null}
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search formats..."
          className="h-10 flex-1 rounded-lg border border-outline-variant/30 bg-surface-primary px-3 text-sm outline-none focus:border-primary-container"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <FormatsShowAllToggle
          showAll={showAll}
          query={params.q ?? ""}
          hiddenEmpty={hiddenEmpty}
        />
        <p className="text-xs text-secondary">
          Showing {visible.length} of {withCounts.length} formats
          {hiddenEmpty > 0 && !showAll
            ? ` · ${hiddenEmpty} empty hidden`
            : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map(({ definition, matches }) => {
          const fypCount = matches.filter((item) =>
            item.href.startsWith("/research"),
          ).length;
          return (
            <Link
              key={definition.slug}
              href={`/collections?format=${definition.slug}${showAll ? "&all=1" : ""}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
              className="group overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-primary paper-shadow transition-transform hover:-translate-y-0.5"
            >
              <div
                className={`min-h-32 bg-gradient-to-br ${familyTone[definition.family]} to-surface-container-lowest p-5`}
              >
                <Badge variant="default">{definition.family}</Badge>
                <h2 className="mt-5 font-headline text-xl font-semibold text-on-background">
                  {definition.name}
                </h2>
              </div>
              <div className="p-4">
                <p className="text-sm leading-relaxed text-secondary">
                  {definition.description}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-secondary">
                  <span>
                    {matches.length} example{matches.length === 1 ? "" : "s"}
                  </span>
                  <span>
                    {fypCount > 0
                      ? `${fypCount} from For You`
                      : "No For You hits yet"}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-outline-variant/30 p-8 text-sm text-secondary">
          No formats with examples yet. Refresh For You on Research, then open
          Formats again — or toggle “Show all formats”.
        </div>
      ) : null}

      {selected ? (
        <section className="mt-8 rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
                Selected format
              </p>
              <h2 className="mt-1 font-headline text-2xl font-semibold text-on-background">
                {selected.name}
              </h2>
              <p className="mt-2 text-sm text-secondary">
                {selected.description}
              </p>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/collections${showAll ? "?all=1" : ""}`}>Close</Link>
            </Button>
          </div>

          {selectedExamples.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-outline-variant/30 p-6 text-sm text-secondary">
              No For You or owned videos look like {selected.name} yet. Keep
              refreshing Research — new niche hits will land here by format.
            </div>
          ) : (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {selectedExamples.map((item) => (
                <Link
                  key={`${item.href}-${item.id}`}
                  href={item.href}
                  className="rounded-lg border border-outline-variant/20 p-4 hover:bg-surface-container-lowest"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="default">{item.platform}</Badge>
                    {item.href.startsWith("/research") ? (
                      <Badge variant="primary">For You</Badge>
                    ) : (
                      <Badge variant="success">Owned</Badge>
                    )}
                    {item.outlierScore != null ? (
                      <Badge variant="warning">
                        {item.outlierScore.toFixed(1)}× outlier
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 font-semibold text-on-background">
                    {item.title}
                  </p>
                  {item.creator ? (
                    <p className="mt-1 text-xs text-secondary">
                      @{item.creator}
                    </p>
                  ) : null}
                  {item.hookText ? (
                    <p className="mt-2 text-sm text-secondary">
                      Hook: “{item.hookText}”
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-secondary">
                    {item.views?.toLocaleString() ?? "Views unavailable"} views
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
