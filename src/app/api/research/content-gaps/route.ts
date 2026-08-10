import { NextResponse } from "next/server";
import { buildContentGapReport } from "@/lib/research/content-gaps";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { topic?: string };
  const report = await buildContentGapReport({
    supabase,
    userId: user.id,
    topic: body.topic,
  });
  return NextResponse.json(report);
}
