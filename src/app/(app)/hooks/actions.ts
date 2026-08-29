"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildHookStoryKnowledgeText,
  getHookStoryLibrarySummary,
  HOOK_STORY_LIBRARY_ID,
} from "@/lib/hooks/starter-library";
import { processKnowledgeDocument } from "@/lib/knowledge/pipeline/process";
import { createClient } from "@/lib/supabase/server";

export async function installHookStoryLibraryAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=%2Fhooks");

  const summary = getHookStoryLibrarySummary();
  const rawText = buildHookStoryKnowledgeText();
  const metadata = {
    starter_pack_id: HOOK_STORY_LIBRARY_ID,
    starter_pack_version: summary.version,
    canonical_hook_count: summary.canonicalHooks,
    raw_hook_count: summary.rawHooks,
    story_architecture_count: summary.architectures,
    viral_swipe_hook_count: summary.viralSwipeHooks,
    provenance_model: "mixed_with_source_statuses",
  };

  const { data: existing, error: lookupError } = await supabase
    .from("knowledge_documents")
    .select("id")
    .eq("user_id", user.id)
    .contains("metadata", { starter_pack_id: HOOK_STORY_LIBRARY_ID })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    redirect(`/hooks?error=${encodeURIComponent(lookupError.message)}`);
  }

  let documentId = existing?.id ?? null;
  if (documentId) {
    const { error } = await supabase
      .from("knowledge_documents")
      .update({
        title: summary.name,
        description:
          "FormCraft's complete hook, storytelling, retention, proof, rehook, and ethical psychology starter library.",
        knowledge_type: "framework",
        source_type: "manual_note",
        raw_text: rawText,
        processing_status: "uploaded",
        processing_error: null,
        importance: "critical",
        include_in_ai: true,
        is_active: true,
        is_archived: false,
        is_favourite: true,
        metadata,
      })
      .eq("id", documentId)
      .eq("user_id", user.id);
    if (error) redirect(`/hooks?error=${encodeURIComponent(error.message)}`);
  } else {
    const { data: created, error } = await supabase
      .from("knowledge_documents")
      .insert({
        user_id: user.id,
        title: summary.name,
        description:
          "FormCraft's complete hook, storytelling, retention, proof, rehook, and ethical psychology starter library.",
        knowledge_type: "framework",
        source_type: "manual_note",
        raw_text: rawText,
        processing_status: "uploaded",
        importance: "critical",
        include_in_ai: true,
        is_active: true,
        is_favourite: true,
        metadata,
      })
      .select("id")
      .single();
    if (error || !created) {
      redirect(`/hooks?error=${encodeURIComponent(error?.message ?? "Could not create the library document.")}`);
    }
    documentId = created.id;
  }

  const processed = await processKnowledgeDocument(supabase, documentId, user.id);
  if (!processed.ok) {
    redirect(`/hooks?error=${encodeURIComponent(processed.error ?? "The library was saved but could not be indexed.")}`);
  }

  revalidatePath("/hooks");
  revalidatePath("/knowledge");
  revalidatePath(`/knowledge/${documentId}`);
  redirect("/hooks?library=installed");
}
