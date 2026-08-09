import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MaterialIcon } from "@/components/layout/material-icon";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ensureDemoKnowledge } from "@/lib/knowledge/demo-seed";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  AiInclusionBadge,
  KnowledgePageActions,
  ProcessingStatusBadge,
} from "./knowledge-actions";

type SearchParams = Promise<{ q?: string; collection?: string }>;

type DocumentRow = {
  id: string;
  title: string;
  knowledge_type: string;
  source_type: string;
  processing_status: string;
  include_in_ai: boolean;
  is_demo: boolean;
  is_favourite: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  collection_id: string | null;
  knowledge_collections: { name: string } | { name: string }[] | null;
  knowledge_document_tags: Array<{
    knowledge_tags: { name: string } | { name: string }[] | null;
  }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function buildCollectionHref(collection: string, q?: string) {
  const params = new URLSearchParams();
  if (collection !== "all") params.set("collection", collection);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/knowledge?${query}` : "/knowledge";
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, collection = "all" } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  await ensureDemoKnowledge(supabase, user.id);

  const { data: collections } = await supabase
    .from("knowledge_collections")
    .select("id, name")
    .eq("user_id", user.id)
    .order("name");

  let query = supabase
    .from("knowledge_documents")
    .select(
      `
      id,
      title,
      knowledge_type,
      source_type,
      processing_status,
      include_in_ai,
      is_demo,
      is_favourite,
      is_archived,
      created_at,
      updated_at,
      collection_id,
      knowledge_collections ( name ),
      knowledge_document_tags (
        knowledge_tags ( name )
      )
    `,
    )
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (collection === "recent") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.gte("updated_at", thirtyDaysAgo.toISOString());
  } else if (collection === "favourites") {
    query = query.eq("is_favourite", true);
  } else if (collection !== "all") {
    query = query.eq("collection_id", collection);
  }

  if (q?.trim()) {
    query = query.or(
      `title.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%,raw_text.ilike.%${q.trim()}%`,
    );
  }

  const { data: documents } = await query;
  const docs = (documents ?? []) as unknown as DocumentRow[];

  const sidebarItems = [
    { id: "all", label: "All Knowledge", icon: "inventory_2" },
    { id: "recent", label: "Recent", icon: "schedule" },
    { id: "favourites", label: "Favourites", icon: "star" },
  ];

  return (
    <div>
      <PageHeader
        title="Teach FormCraft"
        description="Upload documents, write notes, and organize what FormCraft should know about your brand, voice, and strategy. Included items feed AI context with provenance."
        actions={
          <KnowledgePageActions collections={collections ?? []} />
        }
      />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <p className="px-3 text-xs font-semibold uppercase tracking-widest text-primary-container">
            Browse
          </p>
          <nav className="space-y-1">
            {sidebarItems.map((item) => (
              <Link
                key={item.id}
                href={buildCollectionHref(item.id, q)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  collection === item.id
                    ? "bg-surface-container-low font-medium text-on-background"
                    : "text-secondary hover:bg-surface-container-lowest hover:text-on-background",
                )}
              >
                <MaterialIcon name={item.icon} className="text-base" />
                {item.label}
              </Link>
            ))}
          </nav>

          {(collections?.length ?? 0) > 0 ? (
            <>
              <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-widest text-primary-container">
                Collections
              </p>
              <nav className="space-y-1">
                {collections!.map((col) => (
                  <Link
                    key={col.id}
                    href={buildCollectionHref(col.id, q)}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm transition-colors",
                      collection === col.id
                        ? "bg-surface-container-low font-medium text-on-background"
                        : "text-secondary hover:bg-surface-container-lowest hover:text-on-background",
                    )}
                  >
                    {col.name}
                  </Link>
                ))}
              </nav>
            </>
          ) : null}
        </aside>

        <div className="space-y-6">
          <form method="get" className="flex gap-3">
            {collection !== "all" ? (
              <input type="hidden" name="collection" value={collection} />
            ) : null}
            <Input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search knowledge…"
              className="max-w-md"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 text-sm font-medium hover:bg-surface-container-low"
            >
              Search
            </button>
          </form>

          {docs.length === 0 ? (
            <EmptyState
              title="No knowledge yet"
              description={
                q
                  ? "No documents match your search. Try different keywords or clear the filter."
                  : "Upload a document or write a note to start teaching FormCraft your voice and strategy."
              }
              action={<KnowledgePageActions collections={collections ?? []} />}
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {docs.map((doc) => {
                const collectionName = Array.isArray(doc.knowledge_collections)
                  ? doc.knowledge_collections[0]?.name
                  : doc.knowledge_collections?.name;

                const tags = doc.knowledge_document_tags
                  .flatMap((row) => {
                    const tag = row.knowledge_tags;
                    if (!tag) return [];
                    if (Array.isArray(tag)) return tag.map((t) => t.name);
                    return [tag.name];
                  })
                  .filter(Boolean) as string[];

                return (
                  <li key={doc.id}>
                    <Link
                      href={`/knowledge/${doc.id}`}
                      className="block rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow transition-colors hover:border-primary-container/30"
                    >
                      <div className="flex flex-wrap items-start gap-2">
                        <h2 className="font-headline text-lg font-semibold text-on-background">
                          {doc.title}
                        </h2>
                        {doc.is_demo ? <Badge variant="demo">Demo</Badge> : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="default">
                          {doc.knowledge_type.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="default">
                          {doc.source_type.replace(/_/g, " ")}
                        </Badge>
                        <ProcessingStatusBadge status={doc.processing_status} />
                        <AiInclusionBadge included={doc.include_in_ai} />
                      </div>

                      {collectionName ? (
                        <p className="mt-3 text-sm text-secondary">
                          Collection: {collectionName}
                        </p>
                      ) : null}

                      {tags.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <Badge key={tag} variant="primary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : null}

                      <p className="mt-4 text-xs text-secondary">
                        Updated {formatDate(doc.updated_at)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
