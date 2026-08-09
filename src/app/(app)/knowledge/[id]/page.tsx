import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeDetailClient } from "./knowledge-detail";

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: document } = await supabase
    .from("knowledge_documents")
    .select(
      `
      id,
      title,
      description,
      knowledge_type,
      source_type,
      processing_status,
      processing_error,
      raw_text,
      original_filename,
      mime_type,
      include_in_ai,
      is_demo,
      is_favourite,
      is_archived,
      importance,
      collection_id,
      created_at,
      updated_at,
      knowledge_document_tags (
        knowledge_tags ( name )
      )
    `,
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!document) notFound();

  const { data: collections } = await supabase
    .from("knowledge_collections")
    .select("id, name")
    .eq("user_id", user.id)
    .order("name");

  const tags = (document.knowledge_document_tags ?? [])
    .flatMap((row: { knowledge_tags: { name: string } | { name: string }[] | null }) => {
      const tag = row.knowledge_tags;
      if (!tag) return [];
      if (Array.isArray(tag)) return tag.map((t) => t.name);
      return [tag.name];
    })
    .filter(Boolean) as string[];

  return (
    <KnowledgeDetailClient
      document={{
        ...document,
        tags,
      }}
      collections={collections ?? []}
    />
  );
}
