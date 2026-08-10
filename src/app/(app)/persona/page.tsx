import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { PersonaForm } from "./persona-form";

export default async function PersonaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("what_i_make, my_audience, content_style, script_style, creator_profile_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  const values = {
    what_i_make: profile?.what_i_make ?? "",
    my_audience: profile?.my_audience ?? "",
    content_style: profile?.content_style ?? "",
    script_style: profile?.script_style ?? "",
  };
  const completed = Object.values(values).every((value) => value.trim().length >= 20);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Creator profile"
        description="Teach FormCraft what you make, who you serve, and how you sound. This profile becomes high-priority context across the product."
        actions={
          <Badge variant={completed ? "success" : "warning"}>
            {completed ? "Active in AI context" : "Needs setup"}
          </Badge>
        }
      />
      <PersonaForm values={values} />
    </div>
  );
}
