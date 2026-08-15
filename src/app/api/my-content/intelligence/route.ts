import { NextResponse } from "next/server";
import { runContentIntelligencePass } from "@/lib/intelligence/run-pass";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
/** Classification is batched; keep headroom under plan limits. */
export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  try {
    const result = await runContentIntelligencePass({
      supabase,
      userId: user.id,
    });
    if (result.error) {
      return NextResponse.json(result, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Intelligence pass failed.",
        classified: 0,
        lessons: 0,
        insights: 0,
        remainingUnclassified: 0,
        details: [],
      },
      { status: 500 },
    );
  }
}
