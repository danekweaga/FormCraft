import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { auditCreatorProfile } from "@/lib/persona/profile-audit";
import { postsWithUsableText } from "@/lib/persona/rewrite-bio";
import { PersonaForm } from "./persona-form";
import { ProfileAuditPanel } from "./profile-audit-panel";

export default async function PersonaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, { data: posts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("what_i_make, my_audience, content_style, script_style, social_bio, content_pillars, creator_profile_completed_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("content_posts")
      .select("title, caption, topic, content_pillar, classification, published_at")
      .eq("user_id", user.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(60),
  ]);

  const values = {
    what_i_make: profile?.what_i_make ?? "",
    my_audience: profile?.my_audience ?? "",
    content_style: profile?.content_style ?? "",
    script_style: profile?.script_style ?? "",
    social_bio: profile?.social_bio ?? "",
    content_pillars: (profile?.content_pillars ?? []).join(", "),
  };
  const completed = [
    values.what_i_make,
    values.my_audience,
    values.content_style,
    values.script_style,
  ].every((value) => value.trim().length >= 20);

  const audit = auditCreatorProfile({
    whatIMake: values.what_i_make,
    audience: values.my_audience,
    socialBio: values.social_bio,
    contentPillars: profile?.content_pillars ?? [],
    posts: (posts ?? []).map((post) => ({
      title: post.title,
      caption: post.caption,
      topic: post.topic,
      contentPillar: post.content_pillar,
      classification:
        post.classification && typeof post.classification === "object"
          ? (post.classification as Record<string, unknown>)
          : null,
    })),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Creator profile"
        description="Teach FormCraft what you make, who you serve, and how you sound. This profile becomes high-priority context across the product."
        actions={
          <Badge variant={completed ? "success" : "warning"}>
            {completed ? "Active in AI context" : "Needs setup"}
          </Badge>
        }
      />
      <ProfileAuditPanel audit={audit} />
      <div>
        <h2 className="font-headline text-2xl font-semibold text-on-background">
          Edit creator profile
        </h2>
        <p className="mb-4 mt-1 text-sm text-secondary">
          Adjust the direction intentionally, then save and rerun the audit.
        </p>
        <PersonaForm
          values={values}
          suggestedBio={audit.suggestedBio}
          ownedPostCount={postsWithUsableText(
            (posts ?? []).map((post) => ({
              title: post.title,
              caption: post.caption,
              topic: post.topic,
              contentPillar: post.content_pillar,
              classification:
                post.classification && typeof post.classification === "object"
                  ? (post.classification as Record<string, unknown>)
                  : null,
            })),
          ).length}
        />
      </div>
    </div>
  );
}
