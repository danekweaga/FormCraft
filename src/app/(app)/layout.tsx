import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { GlobalQuickCapture } from "@/components/canvas/global-quick-capture";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <div className="min-h-screen bg-surface">
      <AppSidebar />
      <div className="md:ml-64">
        <AppTopBar
          email={user.email}
          displayName={profile?.display_name ?? user.email}
        />
        <main className="min-h-[calc(100vh-4rem)] px-4 py-6 pb-24 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
      <GlobalQuickCapture />
    </div>
  );
}
