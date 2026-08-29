import { NextResponse } from "next/server";
import { refreshNicheFeedIfStale } from "@/lib/research/refresh-niche-feed";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  try {
    const result = await refreshNicheFeedIfStale({
      supabase,
      userId: user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Research refresh failed.";
    console.error(`[research] foreground refresh failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
