"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addEntityToCanvas } from "@/lib/canvas/add-entity";
import { evaluateRepurposing } from "@/lib/repurpose/opportunities";
import { createClient } from "@/lib/supabase/server";

async function authenticated() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

export async function refreshRepurposingOpportunitiesAction() {
  const { supabase, user } = await authenticated();
  const { data: posts, error } = await supabase
    .from("content_posts")
    .select("id, title, caption, hook_text, format, topic, views, comments, shares, saves, is_winner, needs_review, relative_performance")
    .eq("user_id", user.id)
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) redirect(`/series?error=${encodeURIComponent(error.message)}`);

  const rows = (posts ?? []).flatMap((post) =>
    evaluateRepurposing({
      id: post.id,
      title: post.title,
      caption: post.caption,
      hookText: post.hook_text,
      format: post.format,
      topic: post.topic,
      views: post.views,
      comments: post.comments,
      shares: post.shares,
      saves: post.saves,
      isWinner: post.is_winner,
      needsReview: post.needs_review,
      relativePerformance: post.relative_performance as Record<string, unknown>,
    }).map((result) => ({
      user_id: user.id,
      source_content_post_id: post.id,
      opportunity_type: result.opportunityType,
      status: result.opportunityType === "not_worth" ? "not_worth" : "suggested",
      title: result.title,
      reason: result.reason,
      evidence: result.evidence,
      recommendation: result.recommendation,
      updated_at: new Date().toISOString(),
    })),
  );

  if (rows.length) {
    const { error: insertError } = await supabase
      .from("repurposing_opportunities")
      .upsert(rows, { onConflict: "user_id,source_content_post_id,opportunity_type" });
    if (insertError) redirect(`/series?error=${encodeURIComponent(insertError.message)}`);
  }

  revalidatePath("/series");
  redirect(`/series?scanned=${rows.length}`);
}

const opportunitySchema = z.string().uuid();

export async function acceptRepurposingOpportunityAction(formData: FormData) {
  const id = opportunitySchema.safeParse(formData.get("opportunityId"));
  if (!id.success) return;
  const { supabase, user } = await authenticated();
  const { data: opportunity } = await supabase
    .from("repurposing_opportunities")
    .select("id, title, reason, evidence, recommendation, source_content_post_id")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!opportunity) return;

  const canvas = await addEntityToCanvas({
    supabase,
    userId: user.id,
    nodeType: "idea",
    title: opportunity.title,
    body: opportunity.reason,
    contentPostId: opportunity.source_content_post_id,
    payload: {
      source: "repurposing_opportunity",
      opportunityId: opportunity.id,
      evidence: opportunity.evidence,
      recommendation: opportunity.recommendation,
    },
  });

  await supabase
    .from("repurposing_opportunities")
    .update({ status: "accepted", output_canvas_node_id: canvas.nodeId })
    .eq("id", opportunity.id)
    .eq("user_id", user.id);
  revalidatePath("/series");
  redirect(`/canvas/${canvas.boardId}`);
}

export async function dismissRepurposingOpportunityAction(formData: FormData) {
  const id = opportunitySchema.safeParse(formData.get("opportunityId"));
  if (!id.success) return;
  const { supabase, user } = await authenticated();
  await supabase
    .from("repurposing_opportunities")
    .update({ status: "dismissed" })
    .eq("id", id.data)
    .eq("user_id", user.id);
  revalidatePath("/series");
}

const seriesSchema = z.object({
  name: z.string().trim().min(3).max(120),
  thesis: z.string().trim().min(10).max(1000),
  format: z.string().trim().max(100).optional(),
  sourcePostId: z.string().uuid().optional().or(z.literal("")),
});

export async function createSeriesAction(formData: FormData) {
  const parsed = seriesSchema.safeParse({
    name: formData.get("name"),
    thesis: formData.get("thesis"),
    format: formData.get("format"),
    sourcePostId: formData.get("sourcePostId") ?? "",
  });
  if (!parsed.success) redirect("/series?error=Add+a+name+and+a+clear+series+thesis.");
  const { supabase, user } = await authenticated();
  const { data: series, error } = await supabase
    .from("content_series")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      thesis: parsed.data.thesis,
      format: parsed.data.format || null,
      source_content_post_id: parsed.data.sourcePostId || null,
    })
    .select("id")
    .single();
  if (error || !series) redirect(`/series?error=${encodeURIComponent(error?.message ?? "Could not create series")}`);

  const angles = [
    "Define the problem and why it matters",
    "Show the most common mistake",
    "Demonstrate the practical workflow",
    "Answer the strongest objection",
    "Summarize the system with a next step",
  ];
  await supabase.from("content_series_items").insert(
    angles.map((angle, index) => ({
      user_id: user.id,
      series_id: series.id,
      ordinal: index + 1,
      title: `${parsed.data.name} — Part ${index + 1}`,
      angle,
    })),
  );
  revalidatePath("/series");
  redirect(`/series?created=${series.id}`);
}

const seriesItemStatusSchema = z.object({
  itemId: z.string().uuid(),
  status: z.enum(["idea", "scripted", "ready", "published", "skipped"]),
});

export async function updateSeriesItemStatusAction(formData: FormData) {
  const parsed = seriesItemStatusSchema.safeParse({ itemId: formData.get("itemId"), status: formData.get("status") });
  if (!parsed.success) return;
  const { supabase, user } = await authenticated();
  await supabase
    .from("content_series_items")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.itemId)
    .eq("user_id", user.id);
  revalidatePath("/series");
}

export async function deleteSeriesAction(formData: FormData) {
  const id = opportunitySchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase, user } = await authenticated();
  await supabase
    .from("content_series")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id);
  revalidatePath("/series");
}
