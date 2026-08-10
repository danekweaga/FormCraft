"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { STARTER_PSYCHOLOGY_PRINCIPLES } from "@/lib/psychology/starter-library";

const sourceTypes = [
  "doi",
  "pubmed",
  "semantic_scholar",
  "crossref",
  "core",
  "doaj",
  "repository",
  "paper_upload",
  "research_url",
  "book_notes",
] as const;

async function authenticated() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

const sourceSchema = z.object({
  sourceType: z.enum(sourceTypes),
  title: z.string().trim().min(3).max(300),
  url: z.string().trim().url().optional().or(z.literal("")),
  doi: z.string().trim().max(200).optional(),
  citation: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export async function addPsychologySourceAction(formData: FormData) {
  const parsed = sourceSchema.safeParse({
    sourceType: formData.get("sourceType"),
    title: formData.get("title"),
    url: formData.get("url"),
    doi: formData.get("doi"),
    citation: formData.get("citation"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) redirect(`/psychology?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the source")}`);
  const { supabase, user } = await authenticated();
  const { error } = await supabase.from("psychology_sources").insert({
    user_id: user.id,
    source_type: parsed.data.sourceType,
    title: parsed.data.title,
    url: parsed.data.url || null,
    doi: parsed.data.doi || null,
    citation: parsed.data.citation || null,
    notes: parsed.data.notes || null,
  });
  if (error) redirect(`/psychology?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/psychology");
  redirect("/psychology?saved=source");
}

const principleSchema = z.object({
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(3000),
  mechanism: z.string().trim().max(3000).optional(),
  contentApplication: z.string().trim().max(3000).optional(),
  limitations: z.string().trim().max(3000).optional(),
  evidenceStrength: z.enum(["unknown", "limited", "emerging", "moderate", "strong"]),
  sourceId: z.string().uuid().optional().or(z.literal("")),
});

export async function addPsychologyPrincipleAction(formData: FormData) {
  const parsed = principleSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    mechanism: formData.get("mechanism"),
    contentApplication: formData.get("contentApplication"),
    limitations: formData.get("limitations"),
    evidenceStrength: formData.get("evidenceStrength"),
    sourceId: formData.get("sourceId") ?? "",
  });
  if (!parsed.success) redirect(`/psychology?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the principle")}`);
  const { supabase, user } = await authenticated();
  const { data: principle, error } = await supabase
    .from("psychology_principles")
    .upsert(
      {
        user_id: user.id,
        name: parsed.data.name,
        description: parsed.data.description,
        mechanism: parsed.data.mechanism || null,
        content_application: parsed.data.contentApplication || null,
        limitations: parsed.data.limitations || null,
        evidence_strength: parsed.data.evidenceStrength,
        status: parsed.data.evidenceStrength === "unknown" ? "proposed" : "active",
        last_reviewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,name" },
    )
    .select("id")
    .single();
  if (error || !principle) redirect(`/psychology?error=${encodeURIComponent(error?.message ?? "Could not save principle")}`);

  if (parsed.data.sourceId) {
    const { data: ownedSource } = await supabase
      .from("psychology_sources")
      .select("id")
      .eq("id", parsed.data.sourceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (ownedSource) {
      await supabase.from("psychology_principle_sources").upsert({
        principle_id: principle.id,
        source_id: ownedSource.id,
      });
    }
  }

  revalidatePath("/psychology");
  redirect(`/psychology?principle=${principle.id}`);
}

export async function installPsychologyStarterLibraryAction() {
  const { supabase, user } = await authenticated();
  for (const starter of STARTER_PSYCHOLOGY_PRINCIPLES) {
    const { data: source, error: sourceError } = await supabase
      .from("psychology_sources")
      .upsert(
        {
          user_id: user.id,
          source_type: "doi",
          title: starter.source.title,
          url: starter.source.url,
          doi: starter.source.doi,
          citation: starter.source.citation,
          notes: "Curated FormCraft starter source. Review the original paper before making high-stakes claims.",
        },
        { onConflict: "user_id,doi" },
      )
      .select("id")
      .single();
    if (sourceError || !source) redirect(`/psychology?error=${encodeURIComponent(sourceError?.message ?? "Could not install starter source")}`);

    const { data: principle, error: principleError } = await supabase
      .from("psychology_principles")
      .upsert(
        {
          user_id: user.id,
          name: starter.name,
          description: starter.description,
          mechanism: starter.mechanism,
          content_application: starter.contentApplication,
          limitations: starter.limitations,
          evidence_strength: starter.evidenceStrength,
          status: "active",
          last_reviewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,name" },
      )
      .select("id")
      .single();
    if (principleError || !principle) redirect(`/psychology?error=${encodeURIComponent(principleError?.message ?? "Could not install starter principle")}`);
    await supabase.from("psychology_principle_sources").upsert({ principle_id: principle.id, source_id: source.id });
  }
  revalidatePath("/psychology");
  redirect(`/psychology?installed=${STARTER_PSYCHOLOGY_PRINCIPLES.length}`);
}
