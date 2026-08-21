import type { SupabaseClient } from "@supabase/supabase-js";
import { REPORT_TEMPLATES } from "./templates";
import type { ReportDefinitionRow } from "./types";

export async function ensureDefaultReportDefinitions(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReportDefinitionRow[]> {
  const rows = REPORT_TEMPLATES.map((template) => ({
    user_id: userId,
    report_type: template.type,
    name: template.name,
    configuration: { defaultWindow: template.defaultWindow },
  }));
  const { error } = await supabase
    .from("report_definitions")
    .upsert(rows, { onConflict: "user_id,report_type", ignoreDuplicates: true });
  if (error) throw error;
  const { data, error: readError } = await supabase
    .from("report_definitions")
    .select("*")
    .order("created_at");
  if (readError) throw readError;
  return (data ?? []) as ReportDefinitionRow[];
}
