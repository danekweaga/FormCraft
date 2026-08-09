import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeBaselines } from "@/lib/my-content/baseline";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import { PostDetailClient } from "./post-detail";

export default async function MyContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: post } = await supabase
    .from("content_posts")
    .select(
      "id, platform, source, source_label, title, caption, published_at, views, likes, comments, shares, saves, followers_gained, is_winner, needs_review, relative_performance, created_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!post) notFound();

  const { data: recent } = await supabase
    .from("content_posts")
    .select(
      "id, platform, source, source_label, title, caption, published_at, views, likes, comments, shares, saves, followers_gained, is_winner, needs_review, relative_performance, created_at",
    )
    .eq("user_id", user.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const recentPosts = (recent ?? []) as ContentPostRow[];
  const baselines = computeBaselines(recentPosts);

  return (
    <PostDetailClient
      post={post as ContentPostRow}
      recentPosts={recentPosts.slice(0, 10)}
      baselines={baselines}
    />
  );
}
