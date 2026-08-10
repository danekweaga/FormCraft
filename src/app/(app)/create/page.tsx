import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { AddToCanvasButton } from "@/components/canvas/add-to-canvas-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { CreateCaptureForm } from "./create-capture-form";
import { CreateMyVersion } from "./create-my-version";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ researchItem?: string }>;
}) {
  const { researchItem } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: source } = researchItem
    ? await supabase
        .from("research_items")
        .select("id, title, creator_name, platform, hook_text, outlier_score")
        .eq("id", researchItem)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <div>
      <PageHeader
        title="Build"
        description="Move from an evidence-backed opportunity to your spin, idea, script, packaging, and Canvas lineage without bouncing between disconnected tools."
      />

      {source ? (
        <CreateMyVersion
          source={{
            id: source.id,
            title: source.title || source.hook_text || "Research opportunity",
            creator: source.creator_name,
            platform: source.platform,
            hook: source.hook_text,
            outlierScore: source.outlier_score == null ? null : Number(source.outlier_score),
          }}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <CreateCaptureForm />
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardHeader>
              <CardTitle>Start from an opportunity</CardTitle>
              <CardDescription>Use Discover to choose a real outlier or saved reference, then Create My Version asks for your spin before writing anything.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild><Link href="/research?mode=for-you">Find content opportunities</Link></Button>
              <div>
                <AddToCanvasButton nodeType="draft" title="Blank draft" body="Start drafting here" label="Add blank draft to Canvas" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
