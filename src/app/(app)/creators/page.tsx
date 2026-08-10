import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CREATOR_CATALOG } from "@/data/creator-catalog";
import { createClient } from "@/lib/supabase/server";
import { CreatorDirectory } from "./creator-directory";
import { importCreatorCatalogAction } from "./actions";

type PageProps = { searchParams: Promise<{ imported?: string; trackable?: string; error?: string }> };

export default async function CreatorsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: followedRows } = await supabase
    .from("external_creators")
    .select("platform, platform_creator_id, handle")
    .eq("user_id", user.id);
  const followed = (followedRows ?? []).map(
    (row) => `${row.platform}:${row.handle || row.platform_creator_id}`,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Niche creator sources"
        description="These accounts are inputs to Discover. Track supported channels, pull short-form posts published in the last 30 days, and rank each video against that creator’s own median views."
        actions={<div className="flex flex-wrap items-center gap-2"><Badge variant="primary">{CREATOR_CATALOG.length} supplied accounts</Badge><form action={importCreatorCatalogAction}><Button type="submit">Import all into scan</Button></form></div>}
      />
      {params.error ? <p className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">{params.error}</p> : null}
      {params.imported ? <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm"><p className="font-semibold">Imported {params.imported} creator sources.</p><p className="mt-1 text-secondary">{params.trackable ?? 0} can be pulled with your currently configured providers. Instagram competitor feeds remain manual because the official API does not provide them. Open Discover → Watchlists and choose Refresh all watchlist channels.</p></div> : null}
      <CreatorDirectory followed={followed} />
    </div>
  );
}
