export type KnowledgeResult = {
  documentId: string;
  chunkId: string;
  title: string;
  content: string;
  knowledgeType: string;
  collectionId: string | null;
  importance: string;
  score: number;
  provenance: {
    sourceType: "knowledge";
    sourceId: string;
    sourceTitle: string;
  };
};

export interface KnowledgeRetriever {
  retrieve(input: {
    userId: string;
    query: string;
    collectionIds?: string[];
    knowledgeTypes?: string[];
    limit?: number;
  }): Promise<KnowledgeResult[]>;
}
