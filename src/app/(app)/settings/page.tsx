import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name ?? user.email?.split("@")[0] ?? "Creator";

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account details and how FormCraft addresses you across the workspace."
      />

      <Card className="max-w-xl border-outline-variant/20 bg-surface-primary paper-shadow">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your display name appears in the top bar and across the app shell.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm displayName={displayName} />
        </CardContent>
      </Card>
    </div>
  );
}
