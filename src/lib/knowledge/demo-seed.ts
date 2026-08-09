import type { SupabaseClient } from "@supabase/supabase-js";

const DEMO_DOCS = [
  {
    title: "My Content Strategy",
    knowledge_type: "strategy" as const,
    raw_text:
      "Demo strategy notes: prioritize specific personal stories, clear opinions in the first three seconds, and one concrete example per video. This is labelled demo content — not a user upload.",
  },
  {
    title: "Hook Frameworks",
    knowledge_type: "framework" as const,
    raw_text:
      "Demo hook frameworks: contrarian, curiosity gap, pain recognition, result-first, and identity challenge. Use one primary hook and optionally stack a secondary open loop.",
  },
  {
    title: "Scriptwriting Notes",
    knowledge_type: "instruction" as const,
    raw_text:
      "Demo scriptwriting rules: open with tension, deliver proof early, cut filler setup, end with a clear CTA aligned to the payoff.",
  },
  {
    title: "Brand Voice Guide",
    knowledge_type: "voice" as const,
    raw_text:
      "Demo brand voice: direct, specific, lightly contrarian, never generic motivational filler. Prefer concrete numbers and lived experience.",
  },
  {
    title: "Examples of My Best Videos",
    knowledge_type: "example" as const,
    raw_text:
      "Demo examples of strong videos: personal project stories with a failure-first open, AI opinion Yaps under 70 seconds, and internship advice with a save CTA.",
  },
];

export async function ensureDemoKnowledge(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { count } = await supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_demo", true);

  if ((count ?? 0) > 0) return;

  const { data: collection } = await supabase
    .from("knowledge_collections")
    .insert({
      user_id: userId,
      name: "Demo Knowledge",
      description:
        "Clearly labelled demo items so you can explore Teach FormCraft before uploading your own materials.",
    })
    .select("id")
    .single();

  for (const demo of DEMO_DOCS) {
    const { data: doc } = await supabase
      .from("knowledge_documents")
      .insert({
        user_id: userId,
        collection_id: collection?.id ?? null,
        title: demo.title,
        description: "Demo content — not uploaded by you",
        knowledge_type: demo.knowledge_type,
        source_type: "manual_note",
        raw_text: demo.raw_text,
        processing_status: "ready",
        importance: "normal",
        is_demo: true,
        include_in_ai: true,
        metadata: { demo: true },
      })
      .select("id")
      .single();

    if (doc) {
      await supabase.from("knowledge_chunks").insert({
        user_id: userId,
        document_id: doc.id,
        chunk_index: 0,
        content: demo.raw_text,
        token_count: Math.ceil(demo.raw_text.length / 4),
        metadata: { demo: true },
      });
    }
  }
}
