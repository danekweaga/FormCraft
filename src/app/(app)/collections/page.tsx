import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FORMAT_LIBRARY,
  extractRelativeMultiplier,
  normalizeFormatSlug,
} from "@/lib/library/format-library";
import { createClient } from "@/lib/supabase/server";
import { correctPostFormatAction } from "./actions";

const familyTone: Record<string, string> = {
  "Direct-to-camera": "from-emerald-500/35 via-emerald-500/10",
  Educational: "from-blue-500/35 via-blue-500/10",
  Narrative: "from-violet-500/35 via-violet-500/10",
  Entertainment: "from-rose-500/35 via-rose-500/10",
  Visual: "from-amber-500/35 via-amber-500/10",
};

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: posts } = await supabase
    .from("content_posts")
    .select("id, title, caption, platform, format, hook_text, topic, views, relative_performance, published_at")
    .eq("user_id", user.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(240);

  const enriched = (posts ?? []).map((post) => ({
    ...post,
    formatSlug: normalizeFormatSlug(post.format),
    relative: extractRelativeMultiplier(post.relative_performance),
  }));
  const query = params.q?.trim().toLowerCase() ?? "";
  const definitions = FORMAT_LIBRARY.filter((definition) =>
    !query
      ? true
      : `${definition.name} ${definition.family} ${definition.description}`.toLowerCase().includes(query),
  );
  const selected = FORMAT_LIBRARY.find((definition) => definition.slug === params.format) ?? null;
  const selectedPosts = selected
    ? enriched.filter((post) => post.formatSlug === selected.slug)
    : [];

  return (
    <div>
      <PageHeader
        title="Format collections"
        description="An extensible library of content formats. Counts and performance come from your classified posts; empty formats stay empty instead of pretending to have examples."
        actions={
          <Button asChild variant="outline">
            <Link href="/my-content">Correct classifications</Link>
          </Button>
        }
      />

      <form action="/collections" method="get" className="mb-6 flex max-w-xl gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search formats..."
          className="h-10 flex-1 rounded-lg border border-outline-variant/30 bg-surface-primary px-3 text-sm outline-none focus:border-primary-container"
        />
        <Button type="submit" variant="outline">Search</Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {definitions.map((definition) => {
          const matches = enriched.filter((post) => post.formatSlug === definition.slug);
          const relative = matches
            .map((post) => post.relative)
            .filter((value): value is number => value != null);
          const average = relative.length
            ? relative.reduce((sum, value) => sum + value, 0) / relative.length
            : null;
          return (
            <Link
              key={definition.slug}
              href={`/collections?format=${definition.slug}`}
              className="group overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-primary paper-shadow transition-transform hover:-translate-y-0.5"
            >
              <div className={`min-h-32 bg-gradient-to-br ${familyTone[definition.family]} to-surface-container-lowest p-5`}>
                <Badge variant="default">{definition.family}</Badge>
                <h2 className="mt-5 font-headline text-xl font-semibold text-on-background">{definition.name}</h2>
              </div>
              <div className="p-4">
                <p className="text-sm leading-relaxed text-secondary">{definition.description}</p>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-secondary">
                  <span>{matches.length} of my posts</span>
                  <span>{average == null ? "No baseline yet" : `${average.toFixed(1)}x avg relative`}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {selected ? (
        <section className="mt-8 rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-secondary">Selected format</p>
              <h2 className="mt-1 font-headline text-2xl font-semibold text-on-background">{selected.name}</h2>
              <p className="mt-2 text-sm text-secondary">{selected.description}</p>
            </div>
            <Button asChild size="sm" variant="ghost"><Link href="/collections">Close</Link></Button>
          </div>

          {selectedPosts.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-outline-variant/30 p-6 text-sm text-secondary">
              No classified {selected.name} posts yet. FormCraft will not invent examples; classify an existing post or test this format next.
            </div>
          ) : (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {selectedPosts.map((post) => (
                <Link key={post.id} href={`/my-content/${post.id}`} className="rounded-lg border border-outline-variant/20 p-4 hover:bg-surface-container-lowest">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="default">{post.platform}</Badge>
                    {post.relative != null ? <Badge variant={post.relative >= 1 ? "success" : "warning"}>{post.relative.toFixed(1)}x baseline</Badge> : null}
                  </div>
                  <p className="mt-3 font-semibold text-on-background">{post.title || post.caption?.slice(0, 100) || "Untitled post"}</p>
                  {post.hook_text ? <p className="mt-2 text-sm text-secondary">Hook: “{post.hook_text}”</p> : null}
                  <p className="mt-2 text-xs text-secondary">{post.views?.toLocaleString() ?? "Views unavailable"} views · {post.topic ?? "Topic unclassified"}</p>
                  <span className="mt-3 inline-block text-xs font-semibold text-primary">Open post →</span>
                </Link>
              ))}
            </div>
          )}
          {selectedPosts.length ? (
            <div className="mt-6 border-t border-outline-variant/15 pt-5">
              <h3 className="font-semibold">Correct a classification</h3>
              <p className="mt-1 text-xs text-secondary">Manual corrections are locked so automatic classification will not overwrite them.</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {selectedPosts.map((post) => (
                  <form key={post.id} action={correctPostFormatAction} className="flex items-center gap-2 rounded-lg bg-surface-container-lowest p-3">
                    <input type="hidden" name="postId" value={post.id} />
                    <span className="min-w-0 flex-1 truncate text-sm">{post.title || post.caption?.slice(0, 70) || "Untitled post"}</span>
                    <select name="format" defaultValue={post.formatSlug ?? selected.slug} aria-label="Correct format" className="h-9 rounded-lg border border-outline bg-surface px-2 text-xs">
                      {FORMAT_LIBRARY.map((format) => <option key={format.slug} value={format.slug}>{format.name}</option>)}
                    </select>
                    <Button type="submit" size="sm" variant="outline">Save</Button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
