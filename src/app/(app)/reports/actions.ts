"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { generateReportRun } from "@/lib/reports/generate";
import { calculateNextReportRun } from "@/lib/reports/schedule";
import type { ReportWindow } from "@/lib/reports/types";
import { createClient } from "@/lib/supabase/server";

const runSchema = z.object({
  definitionId: z.string().uuid(),
  window: z.enum(["last-10", "last-20", "last-30", "days-30", "days-90", "custom"]),
  start: z.string().optional(),
  end: z.string().optional(),
});

function reportWindow(value: z.infer<typeof runSchema>): ReportWindow {
  if (value.window.startsWith("last-")) {
    return { kind: "last_posts", count: Number(value.window.slice(5)) as 10 | 20 | 30 };
  }
  if (value.window.startsWith("days-")) {
    return { kind: "last_days", days: Number(value.window.slice(5)) as 30 | 90 };
  }
  if (!value.start || !value.end) throw new Error("Choose both custom dates.");
  return { kind: "custom", start: value.start, end: value.end };
}

export async function runReportAction(formData: FormData) {
  const parsed = runSchema.safeParse({
    definitionId: formData.get("definitionId"),
    window: formData.get("window"),
    start: formData.get("start") || undefined,
    end: formData.get("end") || undefined,
  });
  if (!parsed.success) throw new Error("Choose a valid report and data window.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const run = await generateReportRun({ supabase, userId: user.id, definitionId: parsed.data.definitionId, window: reportWindow(parsed.data), trigger: "manual" });
  revalidatePath("/reports");
  redirect(`/reports/${run.id}`);
}

export async function updateReportScheduleAction(formData: FormData) {
  const parsed = z.object({
    definitionId: z.string().uuid(),
    frequency: z.enum(["manual", "daily", "weekly", "monthly"]),
    emailEnabled: z.boolean(),
  }).safeParse({
    definitionId: formData.get("definitionId"),
    frequency: formData.get("frequency"),
    emailEnabled: formData.get("emailEnabled") === "on",
  });
  if (!parsed.success) throw new Error("Invalid schedule.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const scheduleConfig = { hour: 12, weekday: 0, dayOfMonth: 1 };
  const nextRunAt = calculateNextReportRun({ frequency: parsed.data.frequency, scheduleConfig });
  const { error } = await supabase.from("report_schedules").upsert({
    user_id: user.id,
    report_definition_id: parsed.data.definitionId,
    frequency: parsed.data.frequency,
    schedule_config: scheduleConfig,
    email_enabled: parsed.data.emailEnabled,
    enabled: parsed.data.frequency !== "manual",
    next_run_at: nextRunAt,
  }, { onConflict: "user_id,report_definition_id" });
  if (error) throw error;
  revalidatePath("/reports");
}
