import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkText } from "./chunk";
import { extractTextFromBuffer } from "./extract";
import { normalizeText } from "./normalize";

export async function processKnowledgeDocument(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: doc, error: loadError } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (loadError || !doc) {
    return { ok: false, error: loadError?.message ?? "Document not found" };
  }

  await supabase
    .from("knowledge_documents")
    .update({
      processing_status: "processing",
      processing_error: null,
    })
    .eq("id", documentId)
    .eq("user_id", userId);

  try {
    let text = doc.raw_text ? normalizeText(doc.raw_text) : "";

    if (!text && doc.storage_path && doc.mime_type) {
      const { data: file, error: downloadError } = await supabase.storage
        .from("knowledge-files")
        .download(doc.storage_path);

      if (downloadError || !file) {
        throw new Error(downloadError?.message ?? "Failed to download file");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractTextFromBuffer(buffer, doc.mime_type);
      if (!extracted.ok) {
        throw new Error(extracted.error);
      }
      text = extracted.text;
    }

    if (!text) {
      throw new Error("No extractable text available for this document.");
    }

    const chunks = chunkText(text);

    await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", documentId)
      .eq("user_id", userId);

    if (chunks.length > 0) {
      const { error: chunkError } = await supabase.from("knowledge_chunks").insert(
        chunks.map((chunk) => ({
          user_id: userId,
          document_id: documentId,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          token_count: chunk.tokenCount,
          metadata: {},
        })),
      );
      if (chunkError) throw new Error(chunkError.message);
    }

    const { error: updateError } = await supabase
      .from("knowledge_documents")
      .update({
        raw_text: text,
        processing_status: "ready",
        processing_error: null,
      })
      .eq("id", documentId)
      .eq("user_id", userId);

    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Processing failed unexpectedly.";
    await supabase
      .from("knowledge_documents")
      .update({
        processing_status: "failed",
        processing_error: message,
      })
      .eq("id", documentId)
      .eq("user_id", userId);
    return { ok: false, error: message };
  }
}
