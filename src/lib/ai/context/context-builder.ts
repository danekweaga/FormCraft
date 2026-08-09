import type { SupabaseClient } from "@supabase/supabase-js";
import { PostgresKnowledgeRetriever } from "@/lib/knowledge/retrieval/postgres-retriever";
import type { ContextBundle, ContextSource } from "./types";

/**
 * Future AI context builder.
 * Only the Teach FormCraft knowledge slot is wired in this phase.
 * Other slots return empty placeholders — no fake integrations.
 */
export async function buildContext(input: {
  supabase: SupabaseClient;
  userId: string;
  query: string;
  collectionIds?: string[];
}): Promise<ContextBundle> {
  const retriever = new PostgresKnowledgeRetriever(input.supabase);
  const knowledge = await retriever.retrieve({
    userId: input.userId,
    query: input.query,
    collectionIds: input.collectionIds,
    limit: 6,
  });

  const knowledgeSources: ContextSource[] = knowledge.map((item) => ({
    kind: "knowledge",
    title: item.title,
    content: item.content,
    provenance: item.provenance,
  }));

  const deferredSlots: ContextSource[] = [];
  // Intentionally empty until Brand Brain, Research, Memories, Performance exist.

  const sources = [...knowledgeSources, ...deferredSlots];
  const provenance = sources.map((source) => source.provenance);
  const usedFrom = Array.from(
    new Set(provenance.map((entry) => entry.sourceTitle)),
  );

  return { sources, provenance, usedFrom };
}
