import Link from "next/link";
import { redirect } from "next/navigation";
import { IntelligenceExplanation } from "@/components/intelligence/intelligence-explanation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { searchablePlatforms } from "@/lib/research/discovery/registry";
import { scorePersonalRelevance } from "@/lib/research/relevance";
import { createClient } from "@/lib/supabase/server";
import { generateNicheBriefAction } from "./actions";
import { MultiOutlierForm } from "./multi-outlier-form";
import { NicheProfileForm } from "./niche-profile-form";
import {
  ResearchScanForm,
  SaveResearchReferenceForm,
} from "./research-forms";
import {
  ResearchItemCard,
  type ResearchCardItem,
} from "./research-item-card";
import { WatchlistCreateForm } from "./watchlist-form";

const MODES = [
  { id: "for-you", label: "For You" },
  { id: "outliers", label: "Outliers" },
  { id: "watchlists", label: "Watchlists" },
  { id: "discover", label: "Discover" },
  { id: "creators", label: "Creators" },
  { id: "saved", label: "Saved" },
] as const;

type Mode = (typeof MODES)[number]["id"];

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;
  const mode = (MODES.some((m) => m.id === params.mode)
    ? params.mode
    : "for-you") as Mode;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const platforms = searchablePlatforms();
  const youtubeConfigured = Boolean(
    process.env.YOUTUBE_DATA_API_KEY?.trim(),
  );

  const [
    { data: rawItems },
    { data: scans },
    { data: watchlists },
    { data: creators },
    { data: nicheProfile },
    { data: lessons },
    { data: insights },
    { data: roadmap },
    { data: experiments },
    { data: myPosts },
    { data: feedback },
  ] = await Promise.all([
    supabase
      .from("research_items")
      .select(
        "id, platform, external_id, external_url, external_creator_id, creator_name, title, description, thumbnail_url, views, likes, comments, creator_followers, baseline_views, outlier_score, score_basis, outlier_label, baseline_confidence, baseline_sample_size, data_freshness_at, published_at, duration_seconds, hook_text, topic, analysis, analysis_model, saved, source, collection_method, hidden",
      )
      .eq("user_id", user.id)
      .eq("hidden", false)
      .order("outlier_score", { ascending: false, nullsFirst: false })
      .limit(80),
    supabase
      .from("research_scans")
      .select("id, query, status, last_run_at, next_run_at, last_error, parameters")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("research_watchlists")
      .select("id, name, description, paused")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("external_creators")
      .select(
        "id, platform, display_name, handle, follower_count, data_freshness_at, tracking_paused",
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("niche_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("performance_lessons")
      .select("lesson")
      .eq("user_id", user.id)
      .in("status", ["confirmed", "supported", "testing"])
      .limit(8),
    supabase
      .from("audience_insights")
      .select("summary")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(8),
    supabase
      .from("creator_roadmaps")
      .select("goal")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("content_experiments")
      .select("hypothesis")
      .eq("user_id", user.id)
      .eq("status", "running")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("content_posts")
      .select("title, caption, classification")
      .eq("user_id", user.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from("research_feedback")
      .select("feedback_type, research_item_id")
      .eq("user_id", user.id)
      .eq("feedback_type", "hide_creator")
      .limit(100),
  ]);

  const topics = Array.from(
    new Set(
      (myPosts ?? [])
        .map((p) => {
          const c = p.classification as Record<string, unknown> | null;
          return typeof c?.topic === "string"
            ? c.topic
            : (p.title || p.caption || "").slice(0, 40);
        })
        .filter(Boolean),
    ),
  ).slice(0, 12);

  const hiddenFeedbackItemIds = new Set(
    (feedback ?? []).map((entry) => entry.research_item_id),
  );
  const dismissedCreators = Array.from(
    new Set(
      (rawItems ?? [])
        .filter((item) => hiddenFeedbackItemIds.has(item.id))
        .map((item) => item.external_creator_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const evidence = {
    topics: [
      ...topics,
      ...(nicheProfile?.topics ?? []),
      nicheProfile?.main_niche,
    ].filter(Boolean) as string[],
    lessons: (lessons ?? []).map((l) => l.lesson),
    audienceSignals: (insights ?? []).map((i) => i.summary),
    roadmapGoal: roadmap?.goal ?? null,
    activeExperimentHypothesis: experiments?.hypothesis ?? null,
    dismissedCreators,
  };

  const enriched: ResearchCardItem[] = (rawItems ?? []).map((item) => {
    const relevance = scorePersonalRelevance(
      {
        platform: item.platform as "youtube",
        externalId: item.external_id,
        externalUrl: item.external_url,
        creatorId: item.external_creator_id,
        creatorName: item.creator_name,
        title: item.title,
        description: item.description,
        thumbnailUrl: item.thumbnail_url,
        publishedAt: item.published_at,
        durationSeconds: item.duration_seconds,
        views: item.views,
        likes: item.likes,
        comments: item.comments,
        shares: null,
        baselineViews: item.baseline_views,
        outlierScore: item.outlier_score,
        scoreBasis:
          (item.score_basis as
            | "creator_median"
            | "niche_cohort_median"
            | "unavailable") ?? "unavailable",
        topic: item.topic,
      },
      evidence,
    );
    return {
      ...item,
      whyRelevant: relevance.reasons,
      personalFit: relevance.personalFit,
      personalScore: relevance.score,
    };
  });

  const forYou = [...enriched].sort(
    (a, b) => (b.personalScore ?? 0) - (a.personalScore ?? 0),
  );
  const outliers = enriched.filter((i) => (i.outlier_score ?? 0) >= 1.5);
  const saved = enriched.filter((i) => i.saved);

  const latestBrief = (scans ?? []).find(
    (s) =>
      s.parameters &&
      typeof s.parameters === "object" &&
      "nicheBrief" in (s.parameters as object),
  );
  const briefPayload =
    latestBrief?.parameters &&
    typeof latestBrief.parameters === "object" &&
    "nicheBrief" in (latestBrief.parameters as object)
      ? (
          latestBrief.parameters as {
            nicheBrief: Record<string, unknown>;
          }
        ).nicheBrief
      : null;

  return (
    <div>
      <PageHeader
        title="Research"
        description="Niche discovery and watchlists. Outlier scores are creator-relative when possible — never fake viral trends."
        actions={
          <Button asChild variant="outline">
            <Link href="/models">Models</Link>
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {MODES.map((m) => (
          <Button
            key={m.id}
            asChild
            size="sm"
            variant={mode === m.id ? "default" : "outline"}
          >
            <Link href={`/research?mode=${m.id}`}>{m.label}</Link>
          </Button>
        ))}
      </div>

      <p className="mb-6 text-xs text-secondary">
        Searchable now:{" "}
        {platforms.length
          ? platforms
              .map((p) => `${p.platform} (${p.providerName})`)
              .join(", ")
          : "none configured — set YOUTUBE_DATA_API_KEY"}
        . Instagram/TikTok niche search is not available via official APIs —
        use manual save.
      </p>

      {mode === "discover" ? (
        <div className="mb-8 grid gap-6 xl:grid-cols-2">
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardHeader>
              <CardTitle>Discover niche outliers</CardTitle>
              <CardDescription>
                Metadata → local baselines → outliers. Deep AI only when you
                click Analyze.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResearchScanForm configured={youtubeConfigured || platforms.some((p) => p.providerName === "demo")} />
            </CardContent>
          </Card>
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardHeader>
              <CardTitle>Manual reference</CardTitle>
              <CardDescription>
                Paste a public URL when discovery providers cannot search that
                platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SaveResearchReferenceForm />
            </CardContent>
          </Card>
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow xl:col-span-2">
            <CardHeader>
              <CardTitle>Niche profile defaults</CardTitle>
            </CardHeader>
            <CardContent>
              <NicheProfileForm
                initial={{
                  mainNiche: nicheProfile?.main_niche ?? "",
                  topics: (nicheProfile?.topics ?? []).join(", "),
                  keywords: (nicheProfile?.keywords ?? []).join(", "),
                  targetAudience: nicheProfile?.target_audience ?? "",
                }}
              />
            </CardContent>
          </Card>
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow xl:col-span-2">
            <CardHeader>
              <CardTitle>Niche intelligence brief</CardTitle>
              <CardDescription>
                Uses stored research items + your FormCraft context. Gaps are
                labelled potential.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={generateNicheBriefAction} className="flex flex-wrap gap-3">
                <input
                  name="topic"
                  placeholder="Topic e.g. AI for CS students"
                  className="h-10 min-w-[240px] flex-1 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
                  required
                />
                <input type="hidden" name="lookbackDays" value="30" />
                <Button type="submit">Generate niche brief</Button>
              </form>
              {briefPayload ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {Object.entries(briefPayload).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-lg border border-outline-variant/15 p-3 text-sm"
                    >
                      <p className="font-semibold capitalize text-on-background">
                        {key.replace(/([A-Z])/g, " $1")}
                      </p>
                      <p className="mt-1 text-secondary">
                        {Array.isArray(value)
                          ? value.join(" · ") || "—"
                          : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
          {(scans?.length ?? 0) > 0 ? (
            <div className="xl:col-span-2 flex flex-wrap gap-2 text-xs text-secondary">
              <span className="font-semibold text-on-background">
                Saved searches:
              </span>
              {scans!.map((scan) => (
                <Badge key={scan.id} variant="default">
                  {scan.query} · {scan.status}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "watchlists" ? (
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardHeader>
              <CardTitle>Create watchlist</CardTitle>
              <CardDescription>
                Track selected creators separately from niche discovery.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WatchlistCreateForm />
            </CardContent>
          </Card>
          <div className="space-y-3">
            {(watchlists?.length ?? 0) === 0 ? (
              <EmptyState
                title="No watchlists yet"
                description="Create a list like “CS creators”, then Track Creator from an outlier card."
              />
            ) : (
              watchlists!.map((w) => (
                <div
                  key={w.id}
                  className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="primary">{w.name}</Badge>
                    {w.paused ? <Badge variant="warning">Paused</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm text-secondary">
                    {w.description || "No description"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {mode === "creators" ? (
        <div className="mb-8">
          {(creators?.length ?? 0) === 0 ? (
            <EmptyState
              title="No tracked creators"
              description="Track a creator from an outlier card after a Discover scan."
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {creators!.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/research/creators/${c.id}`}
                    className="block rounded-xl border border-outline-variant/20 bg-surface-primary p-4 paper-shadow hover:border-primary-container/40"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="default">{c.platform}</Badge>
                      {c.tracking_paused ? (
                        <Badge variant="warning">Paused</Badge>
                      ) : (
                        <Badge variant="success">Tracking</Badge>
                      )}
                    </div>
                    <p className="mt-2 font-semibold text-on-background">
                      {c.display_name || c.handle || "Creator"}
                    </p>
                    <p className="text-sm text-secondary">
                      {c.follower_count != null
                        ? `${c.follower_count.toLocaleString()} followers`
                        : "Follower count unavailable"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {mode === "outliers" || mode === "for-you" || mode === "saved" ? (
        <div className="mb-6">
          <MultiOutlierForm
            items={(mode === "saved"
              ? saved
              : mode === "outliers"
                ? outliers
                : forYou
            ).slice(0, 20)}
          />
        </div>
      ) : null}

      {mode === "for-you" ? (
        <IntelligenceExplanation
          title="For You ranking"
          confidence="medium"
          why={[
            "Deterministic score from outlier strength + your topics, lessons, audience, roadmap, and experiments.",
            "Deep AI is not used for the full ranking.",
          ]}
          evidence={evidence.topics.slice(0, 4)}
          sources={["My Content", "Performance lessons", "Audience", "Roadmap"]}
        />
      ) : null}

      {mode !== "discover" &&
      mode !== "watchlists" &&
      mode !== "creators" ? (
        (() => {
          const list =
            mode === "saved"
              ? saved
              : mode === "outliers"
                ? outliers
                : forYou;
          if (list.length === 0) {
            return (
              <EmptyState
                title={
                  mode === "saved"
                    ? "Nothing saved yet"
                    : "No research items yet"
                }
                description="Run Discover → niche scan (YouTube when configured). FormCraft will not invent results."
              />
            );
          }
          return (
            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              {list.map((item) => (
                <ResearchItemCard
                  key={item.id}
                  item={item}
                  watchlists={(watchlists ?? []).map((w) => ({
                    id: w.id,
                    name: w.name,
                  }))}
                />
              ))}
            </div>
          );
        })()
      ) : null}

    </div>
  );
}
