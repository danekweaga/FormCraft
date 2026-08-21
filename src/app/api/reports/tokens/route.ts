import { NextResponse } from "next/server";
import { createReportAccessToken } from "@/lib/reports/access-tokens";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { label?: string };
  const created = await createReportAccessToken({ supabase, userId: user.id, label: body.label });
  return NextResponse.json({ token: created.token, scopes: ["reports:read"], message: "Copy this token now. It will not be shown again." });
}
