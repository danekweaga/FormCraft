import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  integrationCounts,
  listAppIntegrations,
} from "@/lib/integrations/catalog";
import {
  getScrapeCreatorsUsage,
} from "@/lib/research/discovery/scrapecreators-client";
import { createClient } from "@/lib/supabase/server";
import { IntegrationsPanel } from "./integrations-panel";
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

  const integrations = listAppIntegrations();
  const counts = integrationCounts(integrations);
  // Do not call the balance endpoint here: ScrapeCreators charges one credit
  // for it. A scan response records the remaining balance without an extra
  // request, and this process-local value is the safe fallback for Settings.
  const scrapeUsage = getScrapeCreatorsUsage();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Account details and every service FormCraft is wired to. Keys stay on the server — this page never shows secrets."
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

      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-on-background">
            Integrations
          </h2>
          <p className="mt-1 text-sm text-secondary">
            {counts.connected} connected · {counts.missing} missing ·{" "}
            {counts.optional} optional. Add keys in{" "}
            <code>.env.local</code> / Vercel, then restart the app.
          </p>
        </div>
        <IntegrationsPanel
          integrations={integrations}
          scrapeCreators={{
            remaining: scrapeUsage.creditsRemaining,
            exhausted: scrapeUsage.exhausted,
            warning: null,
          }}
        />
      </div>
    </div>
  );
}
