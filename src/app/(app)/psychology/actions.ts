"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { STARTER_PSYCHOLOGY_PRINCIPLES } from "@/lib/psychology/starter-library";
import { openAlexProvider } from "@/lib/psychology/providers/openalex";
import type { ScholarlyStudy } from "@/lib/psychology/providers/types";

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
          source_type: starter.source.sourceType ?? "doi",
          source_provider: "formcraft_starter",
          source_provider_id:
            starter.source.providerId ?? `DOI:${starter.source.doi}`,
          title: starter.source.title,
          url: starter.source.url,
          doi: starter.source.doi ?? null,
          citation: starter.source.citation,
          notes: "Curated FormCraft starter source. Review the original paper before making high-stakes claims.",
        },
        { onConflict: "user_id,source_provider,source_provider_id" },
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

const openAlexSaveSchema = z.object({
  providerId: z.string().regex(/^W\d+$/),
});

export async function saveOpenAlexStudyAction(formData: FormData) {
  const parsed = openAlexSaveSchema.safeParse({
    providerId: formData.get("providerId"),
  });
  if (!parsed.success) {
    redirect("/psychology?error=Invalid%20OpenAlex%20study");
  }

  const { supabase, user } = await authenticated();
  let study: ScholarlyStudy;
  try {
    study = await openAlexProvider.getStudy(parsed.data.providerId);
  } catch (error) {
    redirect(
      `/psychology?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Could not load OpenAlex study",
      )}`,
    );
  }

  const row = {
    user_id: user.id,
    source_type: "openalex",
    source_provider: study.provider,
    source_provider_id: study.providerId,
    title: study.title,
    url: study.sourceUrl,
    doi: study.doi,
    citation: [
      study.authors.join(", "),
      study.year ? `(${study.year})` : null,
      study.title,
      study.journal,
    ]
      .filter(Boolean)
      .join(". "),
    notes: study.isRetracted
      ? "OpenAlex marks this work as retracted. Do not use it as supporting evidence."
      : "Imported from OpenAlex. Review the original methods, findings, and limitations before deriving a principle.",
    authors: study.authors,
    publication_year: study.year,
    journal: study.journal,
    study_type: study.studyType,
    abstract: study.abstract,
    full_text_access: study.fullTextAccess,
    is_retracted: study.isRetracted,
    cited_by_count: study.citedByCount,
    metadata: {
      open_access_url: study.openAccessUrl,
      imported_at: new Date().toISOString(),
    },
  };

  const conflict = study.doi
    ? "user_id,doi"
    : "user_id,source_provider,source_provider_id";
  const { error } = await supabase
    .from("psychology_sources")
    .upsert(row, { onConflict: conflict });
  if (error) {
    redirect(`/psychology?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/psychology");
  redirect("/psychology?saved=openalex");
}
