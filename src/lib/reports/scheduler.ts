import type { SupabaseClient } from "@supabase/supabase-js";
import { generateReportRun } from "./generate";
import { reportDeliveryProvider } from "./delivery";
import { calculateNextReportRun } from "./schedule";
import type { ReportResult, ReportScheduleRow, ReportWindow } from "./types";

export async function processDueReportSchedules(admin: SupabaseClient) {
  const now = new Date();
  const { data, error } = await admin.from("report_schedules").select("*,report_definitions!inner(id,configuration)").eq("enabled", true).lte("next_run_at", now.toISOString()).order("next_run_at").limit(10);
  if (error) throw error;
  const results: Array<Record<string, unknown>> = [];
  for (const raw of data ?? []) {
    const schedule = raw as ReportScheduleRow & { report_definitions: { id: string; configuration: { defaultWindow?: ReportWindow } } };
    try {
      const run = await generateReportRun({ supabase: admin, userId: schedule.user_id, definitionId: schedule.report_definition_id, window: schedule.report_definitions.configuration.defaultWindow, trigger: "scheduled" });
      let delivery: Record<string, unknown> = { delivered: false, provider: "none" };
      if (schedule.email_enabled) {
        const { data: userData } = await admin.auth.admin.getUserById(schedule.user_id);
        if (userData.user?.email) delivery = await reportDeliveryProvider().sendReady({ to: userData.user.email, runId: run.id, report: run.result as ReportResult });
      }
      await admin.from("notification_events").upsert({ user_id: schedule.user_id, kind: "report_ready", title: `${(run.result as ReportResult).title} is ready`, body: (run.result as ReportResult).summary, href: `/reports/${run.id}`, dedupe_key: `report-ready:${run.id}`, metadata: { reportType: run.report_type, delivery } }, { onConflict: "user_id,dedupe_key" });
      await admin.from("report_schedules").update({ last_run_at: now.toISOString(), next_run_at: calculateNextReportRun({ frequency: schedule.frequency, scheduleConfig: schedule.schedule_config, from: now }), consecutive_failures: 0, last_error: null }).eq("id", schedule.id);
      results.push({ scheduleId: schedule.id, runId: run.id, ok: true, delivery });
    } catch (scheduleError) {
      const message = scheduleError instanceof Error ? scheduleError.message : "Scheduled report failed";
      await admin.from("report_schedules").update({ consecutive_failures: schedule.consecutive_failures + 1, last_error: message.slice(0, 500), next_run_at: calculateNextReportRun({ frequency: schedule.frequency, scheduleConfig: schedule.schedule_config, from: now }) }).eq("id", schedule.id);
      results.push({ scheduleId: schedule.id, ok: false, error: message });
    }
  }
  return results;
}
