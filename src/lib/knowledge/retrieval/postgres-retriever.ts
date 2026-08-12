import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeRetriever, KnowledgeResult } from "./types";

const importanceWeight: Record<string, number> = {
  low: 0.8,
  normal: 1,
  high: 1.25,
  critical: 1.5,
};

export class PostgresKnowledgeRetriever implements KnowledgeRetriever {
  constructor(private readonly supabase: SupabaseClient) {}

  async retrieve(input: {
    userId: string;
    query: string;
    collectionIds?: string[];
    knowledgeTypes?: string[];
    limit?: number;
  }): Promise<KnowledgeResult[]> {
    const limit = input.limit ?? 8;
    const query = input.query.trim();
    if (!query) return [];

    let docsQuery = this.supabase
      .from("knowledge_documents")
      .select(
        "id, title, knowledge_type, collection_id, importance, raw_text, created_at",
      )
      .eq("user_id", input.userId)
      .eq("include_in_ai", true)
      .eq("is_active", true)
      .eq("is_archived", false)
      .eq("processing_status", "ready");

    if (input.collectionIds?.length) {
      docsQuery = docsQuery.in("collection_id", input.collectionIds);
    }
    if (input.knowledgeTypes?.length) {
      docsQuery = docsQuery.in("knowledge_type", input.knowledgeTypes);
    }

    const { data: documents, error } = await docsQuery
      .textSearch("search_vector", query, {
        type: "websearch",
        config: "english",
      })
      .limit(40);
    if (error || !documents?.length) {
      return [];
    }

    const documentIds = documents.map((doc) => doc.id);
    const { data: chunks } = await this.supabase
      .from("knowledge_chunks")
      .select("id, document_id, content, chunk_index")
      .eq("user_id", input.userId)
      .in("document_id", documentIds)
      .order("chunk_index", { ascending: true });

    const now = Date.now();
    const results: KnowledgeResult[] = [];

    for (const doc of documents) {
      const docChunks =
        chunks?.filter((chunk) => chunk.document_id === doc.id) ?? [];
      const candidates =
        docChunks.length > 0
          ? docChunks
          : [
              {
                id: `${doc.id}-fallback`,
                document_id: doc.id,
                content: (doc.raw_text ?? "").slice(0, 1200),
                chunk_index: 0,
              },
            ];
      const rankedCandidates = candidates
        .map((chunk) => ({ chunk, keywordHits: countKeywordHits(chunk.content, query) }))
        .sort(
          (a, b) =>
            b.keywordHits - a.keywordHits || a.chunk.chunk_index - b.chunk.chunk_index,
        );

      for (const { chunk, keywordHits } of rankedCandidates.slice(0, 2)) {
        const ageDays =
          (now - new Date(doc.created_at).getTime()) / (1000 * 60 * 60 * 24);
        const recency = Math.max(0.5, 1.2 - ageDays / 180);
        const score =
          (1 + keywordHits) *
          (importanceWeight[doc.importance] ?? 1) *
          recency;

        results.push({
          documentId: doc.id,
          chunkId: chunk.id,
          title: doc.title,
          content: chunk.content,
          knowledgeType: doc.knowledge_type,
          collectionId: doc.collection_id,
          importance: doc.importance,
          score,
          provenance: {
            sourceType: "knowledge",
            sourceId: doc.id,
            sourceTitle: doc.title,
          },
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

function countKeywordHits(content: string, query: string): number {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^\w-]/g, ""))
    .filter(Boolean);
  const haystack = content.toLowerCase();
  return terms.reduce(
    (count, term) => count + (haystack.includes(term) ? 1 : 0),
    0,
  );
}
