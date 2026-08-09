"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  allowedKnowledgeMimes,
  collectionSchema,
  documentMetadataSchema,
  noteSchema,
} from "@/lib/knowledge/schemas";
import { processKnowledgeDocument } from "@/lib/knowledge/pipeline/process";
import { createClient } from "@/lib/supabase/server";
import { getKnowledgeMaxFileBytes } from "@/lib/supabase/env";

export type KnowledgeActionState = {
  error?: string;
  success?: boolean;
  documentId?: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", supabase: null, user: null };
  }

  return { supabase, user, error: null };
}

async function verifyDocumentOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  documentId: string,
) {
  const { data: doc, error } = await supabase
    .from("knowledge_documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !doc) {
    return { ok: false as const, error: "Document not found." };
  }

  return { ok: true as const, doc };
}

export async function syncTags(
  documentId: string,
  tagNames: string[],
): Promise<{ error?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const owned = await verifyDocumentOwnership(
    auth.supabase,
    auth.user.id,
    documentId,
  );
  if (!owned.ok) return { error: owned.error };

  const normalized = [
    ...new Set(tagNames.map((t) => t.trim()).filter((t) => t.length > 0)),
  ].slice(0, 20);

  const tagIds: string[] = [];

  for (const name of normalized) {
    const { data: existing } = await auth.supabase
      .from("knowledge_tags")
      .select("id")
      .eq("user_id", auth.user.id)
      .ilike("name", name)
      .maybeSingle();

    if (existing) {
      tagIds.push(existing.id);
      continue;
    }

    const { data: created, error: insertError } = await auth.supabase
      .from("knowledge_tags")
      .insert({ user_id: auth.user.id, name })
      .select("id")
      .single();

    if (insertError || !created) {
      return { error: insertError?.message ?? "Failed to create tag." };
    }

    tagIds.push(created.id);
  }

  const { error: deleteError } = await auth.supabase
    .from("knowledge_document_tags")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) return { error: deleteError.message };

  if (tagIds.length > 0) {
    const { error: linkError } = await auth.supabase
      .from("knowledge_document_tags")
      .insert(tagIds.map((tagId) => ({ document_id: documentId, tag_id: tagId })));

    if (linkError) return { error: linkError.message };
  }

  revalidatePath("/knowledge");
  revalidatePath(`/knowledge/${documentId}`);
  return {};
}

function parseTagsFromForm(formData: FormData): string[] {
  const raw = formData.get("tags");
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function revalidateKnowledge(documentId?: string) {
  revalidatePath("/knowledge");
  if (documentId) revalidatePath(`/knowledge/${documentId}`);
}

export async function createCollection(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const parsed = collectionSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid collection." };
  }

  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const { error } = await auth.supabase.from("knowledge_collections").insert({
    user_id: auth.user.id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/knowledge");
  return { success: true };
}

export async function createNote(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const parsed = noteSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    rawText: formData.get("rawText"),
    collectionId: formData.get("collectionId") || null,
    knowledgeType: formData.get("knowledgeType") || "other",
    importance: formData.get("importance") || "normal",
    tags: parseTagsFromForm(formData),
    includeInAi: formData.get("includeInAi") === "on" || formData.get("includeInAi") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid note." };
  }

  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const { data: doc, error } = await auth.supabase
    .from("knowledge_documents")
    .insert({
      user_id: auth.user.id,
      collection_id: parsed.data.collectionId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      knowledge_type: parsed.data.knowledgeType,
      source_type: "manual_note",
      raw_text: parsed.data.rawText,
      processing_status: "uploaded",
      importance: parsed.data.importance,
      include_in_ai: parsed.data.includeInAi,
    })
    .select("id")
    .single();

  if (error || !doc) return { error: error?.message ?? "Failed to create note." };

  if (parsed.data.tags.length > 0) {
    const tagResult = await syncTags(doc.id, parsed.data.tags);
    if (tagResult.error) return { error: tagResult.error };
  }

  const processResult = await processKnowledgeDocument(
    auth.supabase,
    doc.id,
    auth.user.id,
  );

  if (!processResult.ok) {
    return { error: processResult.error ?? "Note saved but processing failed." };
  }

  revalidateKnowledge(doc.id);
  redirect(`/knowledge/${doc.id}`);
}

const uploadMetadataSchema = documentMetadataSchema.omit({ isFavourite: true });

export async function uploadDocument(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a file to upload." };
  }

  const maxBytes = getKnowledgeMaxFileBytes();
  if (file.size > maxBytes) {
    return {
      error: `File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`,
    };
  }

  const mimeType = file.type || "application/octet-stream";
  if (
    !allowedKnowledgeMimes.includes(
      mimeType as (typeof allowedKnowledgeMimes)[number],
    )
  ) {
    return {
      error: "Unsupported file type. Use TXT, Markdown, or PDF.",
    };
  }

  const parsed = uploadMetadataSchema.safeParse({
    title: formData.get("title") || file.name.replace(/\.[^.]+$/, ""),
    description: formData.get("description") || null,
    collectionId: formData.get("collectionId") || null,
    knowledgeType: formData.get("knowledgeType") || "reference",
    importance: formData.get("importance") || "normal",
    includeInAi:
      formData.get("includeInAi") === "on" ||
      formData.get("includeInAi") === "true",
    tags: parseTagsFromForm(formData),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid metadata." };
  }

  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const { data: doc, error: insertError } = await auth.supabase
    .from("knowledge_documents")
    .insert({
      user_id: auth.user.id,
      collection_id: parsed.data.collectionId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      knowledge_type: parsed.data.knowledgeType,
      source_type: "upload",
      mime_type: mimeType,
      original_filename: file.name,
      processing_status: "uploaded",
      importance: parsed.data.importance,
      include_in_ai: parsed.data.includeInAi,
    })
    .select("id")
    .single();

  if (insertError || !doc) {
    return { error: insertError?.message ?? "Failed to create document." };
  }

  const storagePath = `${auth.user.id}/${doc.id}/${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await auth.supabase.storage
    .from("knowledge-files")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    await auth.supabase.from("knowledge_documents").delete().eq("id", doc.id);
    return { error: uploadError.message };
  }

  const { error: pathError } = await auth.supabase
    .from("knowledge_documents")
    .update({ storage_path: storagePath })
    .eq("id", doc.id)
    .eq("user_id", auth.user.id);

  if (pathError) return { error: pathError.message };

  if (parsed.data.tags && parsed.data.tags.length > 0) {
    const tagResult = await syncTags(doc.id, parsed.data.tags);
    if (tagResult.error) return { error: tagResult.error };
  }

  const processResult = await processKnowledgeDocument(
    auth.supabase,
    doc.id,
    auth.user.id,
  );

  if (!processResult.ok) {
    return {
      error: processResult.error ?? "Upload saved but processing failed.",
      documentId: doc.id,
    };
  }

  revalidateKnowledge(doc.id);
  redirect(`/knowledge/${doc.id}`);
}

export async function updateDocumentMetadata(
  id: string,
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const parsed = documentMetadataSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    collectionId: formData.get("collectionId") || null,
    knowledgeType: formData.get("knowledgeType"),
    importance: formData.get("importance"),
    includeInAi:
      formData.get("includeInAi") === "on" ||
      formData.get("includeInAi") === "true",
    isFavourite:
      formData.get("isFavourite") === "on" ||
      formData.get("isFavourite") === "true",
    tags: parseTagsFromForm(formData),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid metadata." };
  }

  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const owned = await verifyDocumentOwnership(auth.supabase, auth.user.id, id);
  if (!owned.ok) return { error: owned.error };

  const { error } = await auth.supabase
    .from("knowledge_documents")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      collection_id: parsed.data.collectionId ?? null,
      knowledge_type: parsed.data.knowledgeType,
      importance: parsed.data.importance,
      include_in_ai: parsed.data.includeInAi,
      is_favourite: parsed.data.isFavourite ?? false,
    })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };

  if (parsed.data.tags) {
    const tagResult = await syncTags(id, parsed.data.tags);
    if (tagResult.error) return { error: tagResult.error };
  }

  revalidateKnowledge(id);
  return { success: true };
}

export async function toggleIncludeInAi(
  id: string,
  value: boolean,
): Promise<{ error?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const owned = await verifyDocumentOwnership(auth.supabase, auth.user.id, id);
  if (!owned.ok) return { error: owned.error };

  const { error } = await auth.supabase
    .from("knowledge_documents")
    .update({ include_in_ai: value })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };

  revalidateKnowledge(id);
  return {};
}

export async function archiveDocument(id: string): Promise<{ error?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const owned = await verifyDocumentOwnership(auth.supabase, auth.user.id, id);
  if (!owned.ok) return { error: owned.error };

  const { error } = await auth.supabase
    .from("knowledge_documents")
    .update({ is_archived: true, include_in_ai: false })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };

  revalidateKnowledge(id);
  return {};
}

export async function deleteDocument(id: string): Promise<{ error?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const owned = await verifyDocumentOwnership(auth.supabase, auth.user.id, id);
  if (!owned.ok) return { error: owned.error };

  await auth.supabase
    .from("knowledge_chunks")
    .delete()
    .eq("document_id", id)
    .eq("user_id", auth.user.id);

  if (owned.doc.storage_path) {
    await auth.supabase.storage
      .from("knowledge-files")
      .remove([owned.doc.storage_path]);
  }

  const { error } = await auth.supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { error: error.message };

  revalidatePath("/knowledge");
  return {};
}

export async function retryProcessing(id: string): Promise<{ error?: string }> {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return { error: auth.error };

  const owned = await verifyDocumentOwnership(auth.supabase, auth.user.id, id);
  if (!owned.ok) return { error: owned.error };

  const result = await processKnowledgeDocument(
    auth.supabase,
    id,
    auth.user.id,
  );

  if (!result.ok) return { error: result.error ?? "Processing failed." };

  revalidateKnowledge(id);
  return {};
}
