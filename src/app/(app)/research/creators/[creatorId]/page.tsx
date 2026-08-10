import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { baselineConfidence } from "@/lib/research/outliers";
import { getProviderForPlatform } from "@/lib/research/discovery/registry";
import { createClient } from "@/lib/supabase/server";
import { CreatorPostsWorkspace } from "../../creator-posts-workspace";
import type { ResearchCardItem } from "../../research-item-card";

export default async function ResearchCreatorPage({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}) {
  const { creatorId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: creator } = await supabase
    .from("external_creators")
    .select("*")
    .eq("id", creatorId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!creator) notFound();

  const [{ data: posts }, { data: memberships }, { data: watchlists }] =
    await Promise.all([
      supabase
        .from("research_items")
        .select(
          "id, platform, external_id, external_url, external_creator_id, creator_name, title, description, thumbnail_url, views, likes, comments, creator_followers, baseline_views, outlier_score, score_basis, outlier_label, baseline_confidence, baseline_sample_size, data_freshness_at, published_at, duration_seconds, hook_text, topic, analysis, analysis_model, saved, source, collection_method",
        )
        .eq("user_id", user.id)
        .eq("external_creator_id", creatorId)
        .order("outlier_score", { ascending: false, nullsFirst: false })
        .limit(60),
      supabase
        .from("research_watchlist_members")
        .select("watchlist_id, priority, notes")
        .eq("external_creator_id", creatorId),
      supabase
        .from("research_watchlists")
        .select("id, name")
        .eq("user_id", user.id),
    ]);

  const viewSamples = (posts ?? [])
    .map((p) => p.views)
    .filter((v): v is number => typeof v === "number");
  const sorted = [...viewSamples].sort((a, b) => a - b);
  const median =
    sorted.length === 0
      ? null
      : sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
        : sorted[Math.floor(sorted.length / 2)]!;

  const topics = Array.from(
    new Set((posts ?? []).map((p) => p.topic).filter(Boolean)),
  ) as string[];
  const hooks = Array.from(
    new Set((posts ?? []).map((p) => p.hook_text).filter(Boolean)),
  ).slice(0, 6) as string[];
  const wlNames = (memberships ?? [])
    .map((m) => watchlists?.find((w) => w.id === m.watchlist_id)?.name)
    .filter(Boolean);

  const provider = getProviderForPlatform(creator.platform);
  const canAutoPull = Boolean(
    provider?.getCreatorPosts && provider.capabilities().getCreatorPosts,
  );

  const cardPosts = (posts ?? []).map(
    (item) =>
      ({
        ...item,
        analysis: (item.analysis ?? {}) as Record<string, unknown>,
      }) as ResearchCardItem,
  );

  const handle = creator.handle || creator.display_name || "creator";

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/research?mode=creators">← Creators</Link>
      </Button>
      <PageHeader
        title={creator.display_name || creator.handle || "Creator"}
        description={`@${handle} · Profile + outlier workspace (public/tracked data only).`}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="default">{creator.platform}</Badge>
        {creator.handle ? (
          <Badge variant="primary">@{creator.handle}</Badge>
        ) : null}
        {creator.tracking_paused ? (
          <Badge variant="warning">Paused</Badge>
        ) : (
          <Badge variant="success">Tracking</Badge>
        )}
        {wlNames.map((name) => (
          <Badge key={name} variant="primary">
            {name}
          </Badge>
        ))}
      </div>
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4">
          <p className="text-xs uppercase tracking-widest text-secondary">
            Followers
          </p>
          <p className="mt-2 text-xl font-semibold">
            {creator.follower_count != null
              ? creator.follower_count.toLocaleString()
              : "Unavailable"}
          </p>
        </div>
        <div className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4">
          <p className="text-xs uppercase tracking-widest text-secondary">
            Median baseline (views)
          </p>
          <p className="mt-2 text-xl font-semibold">
            {median != null ? Math.round(median).toLocaleString() : "n/a"}
          </p>
          <p className="text-xs text-secondary">
            Confidence: {baselineConfidence(viewSamples.length)} ·{" "}
            {viewSamples.length} posts
          </p>
        </div>
        <div className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4">
          <p className="text-xs uppercase tracking-widest text-secondary">
            Posts tracked
          </p>
          <p className="mt-2 text-xl font-semibold">{posts?.length ?? 0}</p>
          <p className="text-xs text-secondary">
            Outlier = views ÷ this creator&apos;s median
          </p>
        </div>
        <div className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4">
          <p className="text-xs uppercase tracking-widest text-secondary">
            Data freshness
          </p>
          <p className="mt-2 text-sm">
            {creator.data_freshness_at
              ? new Date(creator.data_freshness_at).toLocaleString()
              : "Unknown"}
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-outline-variant/20 p-4">
          <p className="font-semibold">Common topics</p>
          <p className="mt-2 text-sm text-secondary">
            {topics.join(" · ") || "Not enough labeled topics yet"}
          </p>
        </div>
        <div className="rounded-xl border border-outline-variant/20 p-4">
          <p className="font-semibold">Hook previews</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary">
            {hooks.length === 0 ? (
              <li>Run Analyze on posts to surface hooks</li>
            ) : (
              hooks.map((h) => <li key={h}>{h}</li>)
            )}
          </ul>
        </div>
      </div>

      <CreatorPostsWorkspace
        creatorId={creatorId}
        platform={creator.platform}
        posts={cardPosts}
        watchlists={(watchlists ?? []).map((w) => ({
          id: w.id,
          name: w.name,
        }))}
        canAutoPull={canAutoPull}
      />
    </div>
  );
}
