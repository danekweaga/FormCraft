import { describe, expect, it, vi } from "vitest";
import { PostgresKnowledgeRetriever } from "./postgres-retriever";

describe("PostgresKnowledgeRetriever", () => {
  it("returns empty results for blank queries", async () => {
    const supabase = {
      from: vi.fn(),
    };
    const retriever = new PostgresKnowledgeRetriever(supabase as never);
    await expect(
      retriever.retrieve({ userId: "user", query: "   " }),
    ).resolves.toEqual([]);
  });

  it("ranks matching chunks and attaches provenance", async () => {
    const documents = [
      {
        id: "doc-1",
        title: "Hook Frameworks",
        knowledge_type: "framework",
        collection_id: null,
        importance: "high",
        raw_text: "Contrarian hooks create tension.",
        created_at: new Date().toISOString(),
      },
    ];
    const chunks = [
      {
        id: "chunk-0",
        document_id: "doc-1",
        content: "General introduction with no task-specific language.",
        chunk_index: 0,
      },
      {
        id: "chunk-1",
        document_id: "doc-1",
        content: "Contrarian hooks create tension for CS students.",
        chunk_index: 1,
      },
    ];

    const makeChain = (result: unknown) => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = self;
      chain.eq = self;
      chain.in = self;
      chain.textSearch = self;
      chain.limit = async () => result;
      chain.order = async () => result;
      return chain;
    };

    const supabase = {
      from(table: string) {
        if (table === "knowledge_documents") {
          return makeChain({ data: documents, error: null });
        }
        return makeChain({ data: chunks, error: null });
      },
    };

    const retriever = new PostgresKnowledgeRetriever(supabase as never);
    const results = await retriever.retrieve({
      userId: "user-1",
      query: "contrarian hooks",
    });

    expect(results[0]?.title).toBe("Hook Frameworks");
    expect(results[0]?.chunkId).toBe("chunk-1");
    expect(results[0]?.provenance.sourceTitle).toBe("Hook Frameworks");
    expect(results[0]?.score).toBeGreaterThan(0);
  });
});
