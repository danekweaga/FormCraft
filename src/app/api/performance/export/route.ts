import { NextResponse } from "next/server";
import {
  filterPostsByPerformanceRange,
  PERFORMANCE_RANGES,
  type PerformanceRange,
} from "@/lib/my-content/dashboard";
import {
  buildPerformanceAnalyticsXlsx,
  performanceExportFilename,
} from "@/lib/my-content/export-analytics";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("range") ?? "30";
  const range: PerformanceRange = PERFORMANCE_RANGES.includes(
    requested as PerformanceRange,
  )
    ? (requested as PerformanceRange)
    : "30";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: posts, error } = await supabase
    .from("content_posts")
    .select(
      "id, platform, source, source_label, external_url, thumbnail_url, title, caption, topic, content_pillar, hook_text, classification, format, published_at, views, reach, likes, comments, shares, saves, followers_gained, watch_time_seconds, average_view_duration_seconds, completion_rate, profile_visits, link_clicks, is_winner, needs_review, relative_performance, created_at, metrics_refreshed_at, social_connection_id",
    )
    .eq("user_id", user.id)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const selected = filterPostsByPerformanceRange(
    (posts ?? []) as ContentPostRow[],
    range,
  );
  const workbook = buildPerformanceAnalyticsXlsx(selected);
  const filename = performanceExportFilename(range);

  return new NextResponse(new Uint8Array(workbook), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
