import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { AddToCanvasButton } from "@/components/canvas/add-to-canvas-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { BuildFromHookStudio } from "./build-from-hook";
import { CreateCaptureForm } from "./create-capture-form";
import { CreateMyVersion } from "./create-my-version";
import { PasteLinkIdeaForm } from "./paste-link-idea-form";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{
    researchItem?: string;
    hook?: string;
    hookType?: string;
    topic?: string;
  }>;
}) {
  const params = await searchParams;
  const researchItem = params.researchItem;
  const hook = params.hook?.trim() ?? "";
  const hookType = params.hookType?.trim() || null;
  const topic = params.topic?.trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: source } = researchItem
    ? await supabase
        .from("research_items")
        .select("id, title, creator_name, platform, hook_text, outlier_score, external_id, external_url, thumbnail_url")
        .eq("id", researchItem)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <div>
      <PageHeader
        title="Build"
        description="Paste a video link and add your spin, start from a hook, dump a draft, or grade a script — FormCraft keeps the original as evidence, not a clone."
      />

      {hook ? (
        <BuildFromHookStudio hook={hook} hookType={hookType} topic={topic} />
      ) : source ? (
        <CreateMyVersion
          source={{
            id: source.id,
            title: source.title || source.hook_text || "Research opportunity",
            creator: source.creator_name,
            platform: source.platform,
            hook: source.hook_text,
            outlierScore: source.outlier_score == null ? null : Number(source.outlier_score),
            externalId: source.external_id,
            externalUrl: source.external_url,
            thumbnailUrl: source.thumbnail_url,
          }}
        />
      ) : (
        <div className="space-y-6">
          <PasteLinkIdeaForm />
          <div className="grid gap-6 lg:grid-cols-2">
            <CreateCaptureForm />
            <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
              <CardHeader>
                <CardTitle>Start from a hook or opportunity</CardTitle>
                <CardDescription>
                  Open Hooks and hit Build on any template, or pick a real outlier in
                  Discover and Create My Version.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/hooks">Browse Hooks</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/research?mode=for-you">Find opportunities</Link>
                  </Button>
                </div>
                <div>
                  <AddToCanvasButton
                    nodeType="draft"
                    title="Blank draft"
                    body="Start drafting here"
                    label="Add blank draft to Canvas"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
