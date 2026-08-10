import { NextResponse } from "next/server";
import { compareCreators } from "@/lib/research/creator-compare";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    creatorIds?: string[];
  };
  const creatorIds = Array.isArray(body.creatorIds) ? body.creatorIds : [];
  if (creatorIds.length < 2 || creatorIds.length > 5) {
    return NextResponse.json(
      { error: "Select between 2 and 5 creators." },
      { status: 400 },
    );
  }

  const results = await compareCreators({
    supabase,
    userId: user.id,
    creatorIds,
  });
  return NextResponse.json({ results });
}
