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
import { CREATOR_CATALOG } from "@/data/creator-catalog";
import { searchablePlatforms } from "@/lib/research/discovery/registry";
import {
  isScrapeCreatorsConfigured,
  scrapeCreatorsCreditWarning,
} from "@/lib/research/discovery/scrapecreators-client";
import { scorePersonalRelevance } from "@/lib/research/relevance";
import { normalizeResearchFeedFilters } from "@/lib/research/feed-filters";
import type { NicheBrief } from "@/lib/research/niche-brief";
import { createClient } from "@/lib/supabase/server";
import {
  generateNicheBriefAction,
  pullCreatorPostsFormAction,
  toggleWatchlistPausedAction,
} from "./actions";
import { ContentGapsPanel } from "./content-gaps-panel";
import { CreatorComparePanel } from "./creator-compare-panel";
import {
  CreatorSuggestionsPanel,
  type CreatorSuggestionCard,
} from "./creator-suggestions-panel";
import { MultiOutlierForm } from "./multi-outlier-form";
import { NicheProfileForm } from "./niche-profile-form";
import { ResearchFeedWithFilters } from "./research-feed-filters";
import {
  ResearchScanForm,
  SaveResearchReferenceForm,
} from "./research-forms";
import type { ResearchCardItem } from "./research-item-card";
import {
  WatchlistCreateForm,
  WatchlistRefreshForm,
  AddCreatorToWatchlistForm,
} from "./watchlist-form";

export const maxDuration = 60;

const MODES = [
  { id: "for-you", label: "For You" },
  { id: "outliers", label: "Outliers" },
  { id: "watchlists", label: "Watchlists" },
  { id: "discover", label: "Discover" },
  { id: "creators", label: "Creators" },
  { id: "gaps", label: "Gaps" },
  { id: "compare", label: "Compare" },
  { id: "saved", label: "Saved" },
] as const;

type Mode = (typeof MODES)[number]["id"];

function platformLine(platforms: ReturnType<typeof searchablePlatforms>) {
  const parts: string[] = [];
  const yt = platforms.find((p) => p.platform === "youtube");
  const tt = platforms.find((p) => p.platform === "tiktok");
  const ig = platforms.find((p) => p.platform === "instagram");
  const demo = platforms.find((p) => p.providerType === "demo");
  if (yt) {
    parts.push(
      yt.providerName === "scrapecreators"
        ? "YouTube via ScrapeCreators"
        : "YouTube official public search",
    );
  }
  if (tt) {
    parts.push(
      tt.providerName === "scrapecreators"
        ? "TikTok via ScrapeCreators"
        : "TikTok via TikTokAPI.store",
    );
  }
  if (ig) parts.push("Instagram Reels via ScrapeCreators");
  if (demo && !yt && !tt && !ig) parts.push("Demo fixtures (RESEARCH_ENABLE_DEMO)");
  else if (demo) parts.push("Demo available");
  if (parts.length === 0) {
    return "none configured — set SCRAPECREATORS_API_KEY and/or YOUTUBE_DATA_API_KEY";
  }
  return parts.join(" · ");
}

function latestScrapeCreatorsCredits(
  scans: Array<{ parameters: unknown; last_run_at: string | null }> | null,
): { remaining: number | null; exhausted: boolean } | null {
  if (!scans?.length) return null;
  let best: { remaining: number | null; exhausted: boolean; at: number } | null =
    null;
  for (const scan of scans) {
    const params =
      scan.parameters && typeof scan.parameters === "object"
        ? (scan.parameters as Record<string, unknown>)
        : {};
    const stats =
      params.last_run_stats && typeof params.last_run_stats === "object"
        ? (params.last_run_stats as Record<string, unknown>)
        : null;
    const sc =
      stats?.scrapecreators && typeof stats.scrapecreators === "object"
        ? (stats.scrapecreators as Record<string, unknown>)
        : null;
    if (!sc) continue;
    const at = scan.last_run_at ? new Date(scan.last_run_at).getTime() : 0;
    if (best && at < best.at) continue;
    best = {
      remaining:
        typeof sc.credits_remaining === "number" ? sc.credits_remaining : null,
      exhausted: sc.exhausted === true,
      at,
    };
  }
  return best ? { remaining: best.remaining, exhausted: best.exhausted } : null;
}

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; q?: string }>;
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
  const discoveryConfigured = platforms.length > 0;
  const tiktokConfigured = platforms.some((p) => p.platform === "tiktok");
  const youtubeConfigured = platforms.some((p) => p.platform === "youtube");
  const instagramConfigured = platforms.some((p) => p.platform === "instagram");

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
    { data: watchlistMembers },
    { data: creatorSuggestions },
  ] = await Promise.all([
    supabase
      .from("research_items")
      .select(
        "id, platform, external_id, external_url, external_creator_id, creator_name, title, description, thumbnail_url, views, likes, comments, creator_followers, baseline_views, outlier_score, score_basis, outlier_label, baseline_confidence, baseline_sample_size, data_freshness_at, published_at, duration_seconds, hook_text, topic, analysis, analysis_model, saved, source, collection_method, hidden",
      )
      .eq("user_id", user.id)
      .eq("hidden", false)
      .order("outlier_score", { ascending: false, nullsFirst: false })
      .limit(120),
    supabase
      .from("research_scans")
      .select(
        "id, name, query, status, last_run_at, next_run_at, last_error, parameters, auto_scan_enabled, platforms",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
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
      .limit(750),
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
    supabase
      .from("research_watchlist_members")
      .select("watchlist_id, external_creator_id"),
    supabase
      .from("research_creator_suggestions")
      .select(
        "id, watchlist_id, external_creator_id, score, reasons, matched_topics, evidence",
      )
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("score", { ascending: false })
      .limit(18),
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

  const forYou = [...enriched].sort((a, b) => {
    const viewDelta = (b.views ?? 0) - (a.views ?? 0);
    if (viewDelta !== 0) return viewDelta;
    const outlierDelta = (b.outlier_score ?? -1) - (a.outlier_score ?? -1);
    if (outlierDelta !== 0) return outlierDelta;
    return (b.personalScore ?? 0) - (a.personalScore ?? 0);
  });
  const outliers = [...enriched].sort(
    (a, b) => (b.outlier_score ?? -1) - (a.outlier_score ?? -1),
  );
  const watchlistCreatorIds = new Set(
    (watchlistMembers ?? [])
      .map((m) => m.external_creator_id)
      .filter((id): id is string => Boolean(id)),
  );
  const watchlistOutliers = enriched.filter(
    (i) =>
      i.external_creator_id &&
      watchlistCreatorIds.has(i.external_creator_id) &&
      (i.outlier_score == null || i.outlier_score >= 1.5),
  );
  const saved = enriched.filter((i) => i.saved);
  const savedFilterOptions = (scans ?? []).flatMap((scan) => {
    const parameters =
      scan.parameters && typeof scan.parameters === "object"
        ? (scan.parameters as Record<string, unknown>)
        : null;
    if (!parameters || !("savedFilter" in parameters)) return [];
    return [
      {
        id: scan.id,
        name: (scan.name || scan.query || "Saved filter").replace(/^Filter:\s*/i, ""),
        filters: normalizeResearchFeedFilters(parameters.savedFilter),
      },
    ];
  });

  const autoScans = (scans ?? []).filter(
    (s) =>
      s.auto_scan_enabled &&
      typeof s.name === "string" &&
      s.name.startsWith("Auto:"),
  );
  const primaryAuto = autoScans[0] ?? (scans ?? []).find((s) => s.auto_scan_enabled);

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
      ? ((latestBrief.parameters as { nicheBrief: NicheBrief }).nicheBrief ??
        null)
      : null;

  const watchlistOptions = (watchlists ?? []).map((w) => ({
    id: w.id,
    name: w.name,
  }));
  const creatorsById = new Map((creators ?? []).map((creator) => [creator.id, creator]));
  const watchlistsById = new Map(
    (watchlists ?? []).map((watchlist) => [watchlist.id, watchlist]),
  );
  const suggestionCards: CreatorSuggestionCard[] = (creatorSuggestions ?? [])
    .flatMap((suggestion): CreatorSuggestionCard[] => {
      const creator = creatorsById.get(suggestion.external_creator_id);
      const watchlist = watchlistsById.get(suggestion.watchlist_id);
      if (!creator || !watchlist) return [];
      const evidence =
        suggestion.evidence && typeof suggestion.evidence === "object"
          ? (suggestion.evidence as CreatorSuggestionCard["evidence"])
          : null;
      return [
        {
          id: suggestion.id,
          watchlistId: suggestion.watchlist_id,
          watchlistName: watchlist.name,
          externalCreatorId: suggestion.external_creator_id,
          platform: creator.platform,
          handle: creator.handle,
          displayName: creator.display_name,
          followerCount: creator.follower_count,
          score: Number(suggestion.score ?? 0),
          reasons: Array.isArray(suggestion.reasons)
            ? suggestion.reasons.map(String)
            : [],
          matchedTopics: Array.isArray(suggestion.matched_topics)
            ? suggestion.matched_topics.map(String)
            : [],
          evidence,
        },
      ];
    });

  const scrapeCredits = latestScrapeCreatorsCredits(scans ?? []);
  const scrapeCreditWarning = isScrapeCreatorsConfigured()
    ? scrapeCreatorsCreditWarning(
        scrapeCredits?.remaining ?? null,
        scrapeCredits?.exhausted ?? false,
      )
    : null;

  const searchablePlatformIds = new Set(platforms.map((p) => p.platform));
  const creatorOptions = (creators ?? [])
    .filter(
      (creator) =>
        !creator.tracking_paused &&
        searchablePlatformIds.has(creator.platform),
    )
    .map((c) => ({
      id: c.id,
      label: c.display_name || c.handle || "Creator",
      platform: c.platform,
    }));

  const feedList =
    mode === "saved" ? saved : mode === "outliers" ? outliers : forYou;
  const isFeedMode =
    mode === "for-you" || mode === "outliers" || mode === "saved";

  return (
    <div>
      <PageHeader
        title="Research"
        description="Live pull from YouTube, TikTok, and Instagram Reels. Outlier scores are relative, not fake trends."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/canvas">Canvas</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/models">Models</Link>
            </Button>
          </div>
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
        Live sources: {platformLine(platforms)}.
        {isScrapeCreatorsConfigured() && scrapeCredits?.remaining != null
          ? ` ScrapeCreators credits left: ${scrapeCredits.remaining} (1 request = 1 credit).`
          : isScrapeCreatorsConfigured()
            ? " ScrapeCreators is on — remaining credits show after a pull, and on Settings."
            : ""}
      </p>

      {scrapeCreditWarning ? (
        <div className="mb-6 rounded-xl border border-error/30 bg-error/10 p-4 text-sm">
          <p className="font-semibold text-on-background">
            {scrapeCredits?.exhausted || scrapeCredits?.remaining === 0
              ? "ScrapeCreators credits finished"
              : "ScrapeCreators credits running low"}
          </p>
          <p className="mt-1 text-secondary">{scrapeCreditWarning}</p>
        </div>
      ) : null}

      {isFeedMode && enriched.length < 8 ? (
        <div className="mb-6 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-semibold text-on-background">
            Only {enriched.length} video{enriched.length === 1 ? "" : "s"} in
            your feed.
          </p>
          <p className="mt-1 text-secondary">
            Pull YouTube, TikTok, and Instagram for your niche. Old scans kept 3
            “relevant” hits and threw the rest away.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link
              href={`/research?mode=discover&q=${encodeURIComponent(
                (
                  nicheProfile?.main_niche ||
                  primaryAuto?.query ||
                  params.q ||
                  ""
                ).toString(),
              )}`}
            >
              Pull live videos
            </Link>
          </Button>
        </div>
      ) : null}

      {(mode === "discover" || mode === "watchlists") &&
      (creators?.length ?? 0) < CREATOR_CATALOG.length ? (
        <div className="mb-6 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-semibold text-on-background">
            Only {creators?.length ?? 0} of {CREATOR_CATALOG.length} supplied creator
            sources are imported.
          </p>
          <p className="mt-1 text-secondary">
            Import the list first, then refresh the supported YouTube/TikTok
            channels to populate Discover with their last 30 days of short-form
            videos.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/creators">Import creator list</Link>
          </Button>
        </div>
      ) : null}

      {mode === "discover" ? (
        <div className="mb-8 grid gap-6 xl:grid-cols-2">
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardHeader>
              <CardTitle>Discover niche outliers</CardTitle>
              <CardDescription>
                Metadata → local baselines → outliers. Deep AI only when you
                click Analyze. Only the selected live sources are searched.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResearchScanForm
                configured={discoveryConfigured}
                platforms={platforms}
                creators={creatorOptions}
                initialQuery={params.q?.trim().slice(0, 160) ?? ""}
              />
              {primaryAuto ? (
                <div className="mt-3 space-y-1 text-xs text-secondary">
                  <p>
                    Auto-scan “{primaryAuto.name}” is on
                    {primaryAuto.platforms?.length
                      ? ` · platforms: ${primaryAuto.platforms.join(", ")}`
                      : ""}
                    . Last run:{" "}
                    {primaryAuto.last_run_at
                      ? new Date(primaryAuto.last_run_at).toLocaleString()
                      : "not yet"}
                    .
                  </p>
                  {(() => {
                    const params =
                      primaryAuto.parameters &&
                      typeof primaryAuto.parameters === "object"
                        ? (primaryAuto.parameters as Record<string, unknown>)
                        : {};
                    const stats =
                      params.last_run_stats &&
                      typeof params.last_run_stats === "object"
                        ? (params.last_run_stats as Record<string, unknown>)
                        : null;
                    if (!stats) return null;
                    return (
                      <p className="font-medium text-on-background">
                        Last pull: discovered {String(stats.discovered ?? "—")} ·
                        eligible {String(stats.eligible ?? "—")} · retained{" "}
                        {String(stats.retained ?? "—")}
                        {stats.by_platform &&
                        typeof stats.by_platform === "object"
                          ? ` · ${Object.entries(
                              stats.by_platform as Record<string, unknown>,
                            )
                              .map(([plat, n]) => `${plat}:${String(n)}`)
                              .join(" ")}`
                          : ""}
                        {Array.isArray(stats.providers) && stats.providers.length
                          ? ` · ${stats.providers.join(", ")}`
                          : ""}
                      </p>
                    );
                  })()}
                  {primaryAuto.last_error ? (
                    <p className="text-error">
                      Last error: {primaryAuto.last_error}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-xs text-secondary">
                  Save a niche profile below to create an auto-scan that refreshes
                  on schedule without searching every time.
                </p>
              )}
              {(scans?.length ?? 0) > 0 &&
              scans!.some((s) => s.last_error) ? (
                <div className="mt-3 rounded-md border border-error/30 bg-error/5 p-2 text-xs text-error">
                  {(scans ?? [])
                    .filter((s) => s.last_error)
                    .slice(0, 3)
                    .map((s) => (
                      <p key={s.id}>
                        {s.name || s.query}: {s.last_error}
                      </p>
                    ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardHeader>
              <CardTitle>Manual reference</CardTitle>
              <CardDescription>
                Paste a public URL when you already have a specific post, or when
                a platform is not in the live search list.
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
                  platforms: nicheProfile?.platforms ?? [],
                }}
                searchablePlatforms={platforms}
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
                  {(
                    Object.entries(briefPayload) as Array<[string, unknown]>
                  ).map(([key, value]) => (
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
            <div className="xl:col-span-2 space-y-2 text-xs text-secondary">
              <div className="flex flex-wrap gap-2">
                <span className="font-semibold text-on-background">
                  Saved searches:
                </span>
                {scans!.map((scan) => {
                  const params =
                    scan.parameters && typeof scan.parameters === "object"
                      ? (scan.parameters as Record<string, unknown>)
                      : {};
                  const stats =
                    params.last_run_stats &&
                    typeof params.last_run_stats === "object"
                      ? (params.last_run_stats as Record<string, unknown>)
                      : null;
                  return (
                    <Badge key={scan.id} variant="default">
                      {scan.name || scan.query} · {scan.status}
                      {scan.auto_scan_enabled ? " · auto" : ""}
                      {stats
                        ? ` · ${String(stats.discovered ?? "?")}/${String(stats.eligible ?? "?")}/${String(stats.retained ?? "?")}`
                        : ""}
                      {scan.last_error ? " · error" : ""}
                    </Badge>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "discover" ? (
        <section className="mb-8 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-on-background">
              Filter collected outliers
            </h2>
            <p className="mt-1 text-sm text-secondary">
              Change channel, keywords, outlier score, views, engagement,
              posting date, and platform without running another API pull.
            </p>
          </div>
          <ResearchFeedWithFilters
            items={outliers}
            watchlists={watchlistOptions}
            savedFilters={savedFilterOptions}
          />
        </section>
      ) : null}

      {mode === "watchlists" ? (
        <div className="mb-8 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
              <CardHeader>
                <CardTitle>Create watchlist</CardTitle>
                <CardDescription>
                  Niche creator lists — FormCraft pulls their posts and scores
                  outliers vs each creator&apos;s baseline (Sandcastle-style).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <WatchlistCreateForm />
                <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3">
                  <p className="text-sm font-medium text-on-background">
                    Refresh all watchlist channels
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    Pulls latest posts for creators on active watchlists only —
                    not a broad niche search.
                  </p>
                  <WatchlistRefreshForm />
                </div>
              </CardContent>
            </Card>
            <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
              <CardHeader>
                <CardTitle>Add creator by handle</CardTitle>
                <CardDescription>
                  Add TikTok, Instagram, or YouTube creators you already know
                  are in your niche, then pull their recent outliers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddCreatorToWatchlistForm
                  watchlists={watchlistOptions}
                  tiktokConfigured={tiktokConfigured}
                  youtubeConfigured={youtubeConfigured}
                  instagramConfigured={instagramConfigured}
                />
              </CardContent>
            </Card>
          </div>
          <CreatorSuggestionsPanel
            suggestions={suggestionCards}
            watchlists={watchlistOptions}
            configuredPlatforms={platforms.map((entry) => entry.platform)}
          />
          <div className="space-y-3">
            {(watchlists?.length ?? 0) === 0 ? (
              <EmptyState
                title="No watchlists yet"
                description="Create a list like “CS creators”, then add 5+ TikTok/YouTube handles. Refresh — outliers appear when a post beats that creator’s median."
              />
            ) : (
              watchlists!.map((w) => {
                const memberIds = (watchlistMembers ?? [])
                  .filter((m) => m.watchlist_id === w.id)
                  .map((m) => m.external_creator_id);
                const members = (creators ?? []).filter((c) =>
                  memberIds.includes(c.id),
                );
                return (
                  <div
                    key={w.id}
                    className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="primary">{w.name}</Badge>
                      {w.paused ? <Badge variant="warning">Paused</Badge> : null}
                      <Badge variant="default">
                        {members.length} creator{members.length === 1 ? "" : "s"}
                      </Badge>
                      <form
                        action={toggleWatchlistPausedAction}
                        className="ml-auto"
                      >
                        <input type="hidden" name="id" value={w.id} />
                        <input
                          type="hidden"
                          name="paused"
                          value={w.paused ? "false" : "true"}
                        />
                        <Button type="submit" size="sm" variant="ghost">
                          {w.paused ? "Resume" : "Pause"}
                        </Button>
                      </form>
                    </div>
                    <p className="mt-2 text-sm text-secondary">
                      {w.description || "No description"}
                    </p>
                    {members.length > 0 ? (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {members.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center gap-1 rounded-full border border-outline-variant/25 pl-2.5 pr-1 py-0.5"
                          >
                            <Link
                              href={`/research/creators/${c.id}`}
                              className="text-xs text-secondary hover:text-on-background"
                            >
                              @{c.handle || c.display_name} · {c.platform}
                            </Link>
                            {c.platform === "tiktok" ||
                            c.platform === "youtube" ? (
                              <form action={pullCreatorPostsFormAction}>
                                <input
                                  type="hidden"
                                  name="creatorId"
                                  value={c.id}
                                />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 text-[10px]"
                                >
                                  Pull
                                </Button>
                              </form>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-secondary">
                        Add 5+ creators by handle above, then Refresh — outliers
                        appear when a post beats that creator&apos;s median.
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {watchlistOutliers.length > 0 ? (
            <div>
              <h3 className="mb-3 font-headline text-lg font-semibold text-on-background">
                Watchlist outliers
              </h3>
              <ResearchFeedWithFilters
                items={watchlistOutliers}
                watchlists={watchlistOptions}
              />
            </div>
          ) : (watchlists?.length ?? 0) > 0 ? (
            <EmptyState
              title="No watchlist outliers yet"
              description="Add 5+ creators, then Refresh (or Pull on a creator). Outliers appear when a post is ≥1.5× that creator’s median views."
            />
          ) : null}
        </div>
      ) : null}

      {mode === "creators" ? (
        <div className="mb-8">
          {(creators?.length ?? 0) === 0 ? (
            <EmptyState
              title="No tracked creators"
              description="Add TikTok/YouTube handles under Watchlists, or Track creator from an outlier card. Open a profile to filter outliers and pull posts."
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

      {mode === "gaps" ? (
        <div className="mb-8">
          <ContentGapsPanel initial={null} />
        </div>
      ) : null}

      {mode === "compare" ? (
        <div className="mb-8">
          <CreatorComparePanel creators={creatorOptions} />
        </div>
      ) : null}

      {isFeedMode ? (
        <div className="mb-6">
          <MultiOutlierForm items={feedList.slice(0, 20)} />
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

      {isFeedMode ? (
        feedList.length === 0 ? (
          <EmptyState
            title={
              mode === "saved" ? "Nothing saved yet" : "No research items yet"
            }
            description="Run Discover with TikTok (and optionally YouTube), or refresh watchlist channels. FormCraft will not invent results."
          />
        ) : (
          <div className="mt-6">
            <ResearchFeedWithFilters
              items={feedList}
              watchlists={watchlistOptions}
            />
          </div>
        )
      ) : null}
    </div>
  );
}
