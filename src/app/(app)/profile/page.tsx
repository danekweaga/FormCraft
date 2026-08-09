import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MaterialIcon } from "@/components/layout/material-icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
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
        title="Profile"
        description="Your FormCraft identity — the account details tied to this workspace."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings">
              <MaterialIcon name="settings" className="text-base" />
              Edit settings
            </Link>
          </Button>
        }
      />

      <Card className="max-w-xl border-outline-variant/20 bg-surface-primary paper-shadow">
        <CardHeader>
          <CardTitle>{displayName}</CardTitle>
          <CardDescription>Signed in as {user.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-secondary">
                Display name
              </dt>
              <dd className="mt-1 text-sm font-medium text-on-background">
                {displayName}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-secondary">
                Email
              </dt>
              <dd className="mt-1 text-sm font-medium text-on-background">
                {user.email}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
