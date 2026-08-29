"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import {
  addResearchItemToCanvasAction,
  deleteResearchItemAction,
  generateHookMachineAction,
  generateIdeasFromResearchAction,
  submitResearchFeedbackAction,
  toggleResearchSavedAction,
  trackCreatorFromItemAction,
  type ResearchActionState,
} from "./actions";
import { breakDownResearchItemAction } from "@/app/(app)/analyze/actions";
import { saveEditingPatternFromAnalysisAction } from "@/app/(app)/pre-publish/actions";

export type ResearchCardItem = {
  id: string;
  platform: string;
  external_id: string;
  external_url: string;
  external_creator_id: string | null;
  creator_name: string | null;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  creator_followers: number | null;
  baseline_views: number | null;
  outlier_score: number | null;
  score_basis: string | null;
  outlier_label: string | null;
  baseline_confidence: string | null;
  baseline_sample_size: number | null;
  data_freshness_at: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  hook_text: string | null;
  topic: string | null;
  analysis: Record<string, unknown>;
  analysis_model: string | null;
  saved: boolean;
  source: string;
  collection_method?: string | null;
  whyRelevant?: string[];
  personalFit?: string | null;
  personalScore?: number;
  recommendationScore?: number;
};

function compactCount(value: number | null): string | null {
  if (value == null) return null;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function outlierScoreLabel(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 1000) return `${Math.round(value).toLocaleString()}×`;
  return `${value.toFixed(1)}×`;
}

function engagementLabel(item: ResearchCardItem): string | null {
  if (!item.views || item.views <= 0) return null;
  const interactions = (item.likes ?? 0) + (item.comments ?? 0);
  return `${((interactions / item.views) * 100).toFixed(1)}%`;
}

function platformMark(platform: string): string {
  if (platform === "instagram") return "IG";
  if (platform === "tiktok") return "TT";
  if (platform === "youtube") return "YT";
  return platform.slice(0, 2).toUpperCase();
}

function freshnessLabel(iso: string | null) {
  if (!iso) return "Freshness unknown";
  const timestamp = new Date(iso);
  if (Number.isNaN(timestamp.getTime())) return "Freshness unknown";
  // Use a deterministic UTC date. Relative `Date.now()` output can change
  // between server rendering and hydration and causes a visible React error.
  return `Updated ${timestamp.toISOString().slice(0, 10)}`;
}

function publishedLabel(iso: string | null) {
  if (!iso) return "Post date unavailable";
  const timestamp = new Date(iso);
  if (Number.isNaN(timestamp.getTime())) return "Post date unavailable";
  const month = timestamp.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  return `Posted ${month} ${timestamp.getUTCDate()}, ${timestamp.getUTCFullYear()}`;
}

function shouldBypassImageOptimizer(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith(".tiktokcdn.com") ||
      host.endsWith(".tiktokcdn-us.com") ||
      host.endsWith(".tiktokcdn-eu.com") ||
      host.endsWith(".cdninstagram.com") ||
      host.endsWith(".fbcdn.net")
    );
  } catch {
    return false;
  }
}

function platformTone(platform: string) {
  if (platform === "tiktok") return "bg-[#111111] text-white";
  if (platform === "youtube") return "bg-[#c1121f] text-white";
  if (platform === "instagram") return "bg-[#7b2d8e] text-white";
  return "bg-on-background text-surface-container-lowest";
}

function mediaPreviewUrls(item: ResearchCardItem): string[] {
  const urls: string[] = [];
  // Do not hand HEIC directly to the browser. Old TikTok rows that could not
  // be repaired should show the intentional fallback instead of a blank tile.
  if (item.thumbnail_url && !/\.heic(?:\?|$)/i.test(item.thumbnail_url)) {
    urls.push(item.thumbnail_url);
  }
  if (item.platform === "youtube" && item.external_id) {
    const youtube = `https://i.ytimg.com/vi/${item.external_id}/hqdefault.jpg`;
    if (!urls.includes(youtube)) urls.push(youtube);
  }
  return urls;
}

export function ResearchItemCard({
  item,
  watchlists = [],
  showDismissActions = false,
}: {
  item: ResearchCardItem;
  watchlists?: Array<{ id: string; name: string }>;
  /** Prominent delete / don't-recommend controls for Discover and feed cleanup. */
  showDismissActions?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showMore, setShowMore] = useState(false);
  const [thumbIndex, setThumbIndex] = useState(0);
  const [actionMessage, setActionMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [hookPack, setHookPack] = useState<ResearchActionState["hooks"]>();
  const analysis = item.analysis ?? {};
  const reasons = Array.isArray(analysis.whyItMayWork)
    ? (analysis.whyItMayWork as string[])
    : [];
  const principles = Array.isArray(analysis.reusablePattern)
    ? (analysis.reusablePattern as string[])
    : typeof analysis.reusablePattern === "string"
      ? [analysis.reusablePattern]
      : [];
  const preview = mediaPreviewUrls(item)[thumbIndex] ?? null;
  const views = compactCount(item.views);
  const outlierScore = outlierScoreLabel(item.outlier_score);
  const engagement = engagementLabel(item);
  const title = item.title || item.hook_text || "Untitled reference";
  const originalLinkAvailable =
    item.platform !== "tiktok" ||
    /\/video\/\d{15,24}(?:\/|$)/.test(item.external_url);

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-primary shadow-sm transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary-container/35 hover:shadow-md">
      <div className="relative aspect-[9/16] overflow-hidden bg-on-background">
        <a
          href={originalLinkAvailable ? item.external_url : undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!originalLinkAvailable}
          className={`absolute inset-0 block ${originalLinkAvailable ? "" : "cursor-default"}`}
          aria-label={`Open original: ${title}`}
        >
          {preview ? (
            <Image
              key={preview}
              src={preview}
              alt={`Preview for ${title}`}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              unoptimized={shouldBypassImageOptimizer(preview)}
              referrerPolicy="no-referrer"
              onError={() => setThumbIndex((index) => index + 1)}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-white/50">
              No preview
            </span>
          )}
        </a>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />
        <div className="pointer-events-none absolute right-2.5 top-2.5 z-[1] flex flex-wrap gap-1.5">
          <span
            className={`flex size-8 items-center justify-center rounded-full border border-white/35 text-[10px] font-bold shadow-lg ${platformTone(item.platform)}`}
            title={item.platform}
          >
            {platformMark(item.platform)}
          </span>
        </div>
        {item.saved ? (
          <span className="pointer-events-none absolute left-2.5 top-2.5 z-[1] rounded-full bg-primary-container px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-on-primary-container shadow-lg">
            Saved
          </span>
        ) : null}
        <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-black/45 text-white shadow-lg backdrop-blur-sm transition-transform duration-200 group-hover:scale-105">
            <span className="ml-0.5 text-lg" aria-hidden="true">
              ▶
            </span>
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <header className="min-w-0">
          <h3
            className="line-clamp-1 font-sans text-sm font-semibold leading-snug text-on-background"
            title={title}
          >
            {title}
          </h3>
          <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-xs text-secondary">
            <p className="truncate">@{item.creator_name ?? "creator"}</p>
            <p className="shrink-0" title={item.published_at ?? undefined}>
              {publishedLabel(item.published_at).replace(/^Posted /, "")}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold">
          <span className="truncate rounded-md bg-emerald-500/12 px-2 py-1.5 text-center text-emerald-600 dark:text-emerald-400">
            ↗ {outlierScore ?? "New"}
          </span>
          <span
            className="truncate rounded-md bg-blue-500/12 px-2 py-1.5 text-center text-blue-600 dark:text-blue-400"
            title={item.views == null ? "Views unknown from this provider" : undefined}
          >
            ◉ {views ?? "views?"}
          </span>
          <span className="truncate rounded-md bg-orange-500/12 px-2 py-1.5 text-center text-orange-600 dark:text-orange-400">
            ✦ {engagement ?? "—"}
          </span>
        </div>

        <div className="mt-auto grid grid-cols-3 gap-1.5 border-t border-outline-variant/15 pt-3">
          <Button asChild size="sm" className="px-2">
            <Link href={`/create?researchItem=${item.id}`}>Create</Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setActionMessage(null);
                const result = await breakDownResearchItemAction(item.id);
                if (result.error) {
                  setActionMessage({ kind: "error", text: result.error });
                  return;
                }
                if (result.analysisId) router.push(`/analyze/${result.analysisId}`);
              })
            }
          >
            {pending ? "Working…" : "Analyze"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={showMore}
            onClick={() => setShowMore((value) => !value)}
          >
            {showMore ? "Less" : "More"}
          </Button>
        </div>

        {showDismissActions ? (
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const fd = new FormData();
                  fd.set("itemId", item.id);
                  fd.set("feedbackType", "not_relevant");
                  await submitResearchFeedbackAction(fd);
                  setActionMessage({
                    kind: "success",
                    text: "Won't recommend similar videos.",
                  });
                  router.refresh();
                })
              }
            >
              Don&apos;t recommend
            </Button>
            <form action={deleteResearchItemAction} className="min-w-0">
              <input type="hidden" name="id" value={item.id} />
              <ConfirmDeleteButton
                label="Delete"
                confirmMessage="Remove this video from your research library?"
                variant="ghost"
                className="h-9 w-full text-error hover:text-error"
              />
            </form>
          </div>
        ) : null}

        {hookPack ? (
          <div className="space-y-3 rounded-xl bg-surface-container-lowest p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-container">
              Hook Machine
            </p>
            {hookPack.formatMatched?.length ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-on-background">
                  Format-matched
                </p>
                {hookPack.formatMatched.map((hook) => (
                  <div key={hook.text} className="rounded-lg border border-outline-variant/15 p-2.5">
                    <p className="text-sm font-medium text-on-background">
                      {hook.text}
                    </p>
                    <p className="mt-1 text-xs text-secondary">
                      {hook.grade}
                      {hook.formatLabel ? ` · ${hook.formatLabel}` : ""} · {hook.note}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-on-background">Original</p>
              {(hookPack.original ?? []).map((hook) => (
                <div key={hook.text} className="rounded-lg border border-outline-variant/15 p-2.5">
                  <p className="text-sm font-medium text-on-background">{hook.text}</p>
                  <p className="mt-1 text-xs text-secondary">
                    {hook.grade} · {hook.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {showMore ? (
          <div className="space-y-3 text-sm">
            <blockquote className="rounded-lg border-l-2 border-primary-container bg-surface-container-lowest p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-container">
                Spoken hook
              </p>
              <p className="mt-1 leading-snug text-on-background">
                {item.hook_text ??
                  "Unavailable until captions, a pasted transcript, or an uploaded video is analyzed."}
              </p>
            </blockquote>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">
                {(item.source ?? "unknown").replace(/_/g, " ")}
              </Badge>
              {item.baseline_confidence ? (
                <Badge
                  variant={
                    item.baseline_confidence === "high"
                      ? "success"
                      : item.baseline_confidence === "medium"
                        ? "primary"
                        : "warning"
                  }
                >
                  Baseline {item.baseline_confidence}
                  {item.baseline_sample_size != null
                    ? ` · n=${item.baseline_sample_size}`
                    : ""}
                </Badge>
              ) : null}
              {item.analysis_model ? (
                <Badge variant="default">Analyzed</Badge>
              ) : (
                <Badge variant="warning">Not analyzed</Badge>
              )}
              {item.personalFit ? (
                <Badge variant="primary">Fit: {item.personalFit}</Badge>
              ) : null}
              {item.recommendationScore != null ? (
                <Badge variant="success">
                  For You {Math.round(item.recommendationScore)}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-secondary">
              Outlier{" "}
              {item.outlier_score != null
                ? `${Number(item.outlier_score).toFixed(1)}×`
                : "n/a"}{" "}
              · {item.score_basis?.replace(/_/g, " ") ?? "unavailable"} ·{" "}
              {freshnessLabel(item.data_freshness_at)}
              {item.topic ? ` · ${item.topic}` : ""}
            </p>
            {item.whyRelevant && item.whyRelevant.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-secondary">
                {item.whyRelevant.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
            {reasons.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-secondary">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
            {principles.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-secondary">
                {principles.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setActionMessage(null);
                    const fd = new FormData();
                    fd.set("id", item.id);
                    const result = await generateHookMachineAction(fd);
                    if (result.hooks) setHookPack(result.hooks);
                    setActionMessage({
                      kind: result.error ? "error" : "success",
                      text:
                        result.error ??
                        result.success ??
                        "Hook Machine finished.",
                    });
                  })
                }
              >
                {pending ? "Writing hooks…" : "Hook Machine"}
              </Button>
              {originalLinkAvailable ? (
                <Button asChild size="sm" variant="outline">
                  <a href={item.external_url} target="_blank" rel="noopener noreferrer">
                    Open original
                  </a>
                </Button>
              ) : null}
              {item.platform === "youtube" ? (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://youtube-transcript.ai/transcript?v=${encodeURIComponent(item.external_id)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Transcript
                  </a>
                </Button>
              ) : null}
              {item.external_creator_id ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/research/creators/${item.external_creator_id}`}>
                    Creator
                  </Link>
                </Button>
              ) : null}
              <form action={saveEditingPatternFromAnalysisAction}>
                <input type="hidden" name="researchItemId" value={item.id} />
                <input
                  type="hidden"
                  name="name"
                  value={`Editing · ${item.title || item.creator_name || "research"}`}
                />
                <Button type="submit" size="sm" variant="outline">
                  Save editing pattern
                </Button>
              </form>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await generateIdeasFromResearchAction(
                      (() => {
                        const fd = new FormData();
                        fd.set("id", item.id);
                        return fd;
                      })(),
                    );
                  })
                }
              >
                Ideas → Idea Gate
              </Button>
              <form action={toggleResearchSavedAction}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="nextSaved" value={String(!item.saved)} />
                <Button
                  type="submit"
                  size="sm"
                  variant={item.saved ? "ghost" : "default"}
                >
                  {item.saved ? "Unsave" : "Save"}
                </Button>
              </form>
              {watchlists[0] ? (
                <form action={trackCreatorFromItemAction}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="watchlistId" value={watchlists[0].id} />
                  <Button type="submit" size="sm" variant="outline">
                    Track creator
                  </Button>
                </form>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const fd = new FormData();
                    fd.set("itemId", item.id);
                    fd.set("feedbackType", "relevant");
                    await submitResearchFeedbackAction(fd);
                    setActionMessage({
                      kind: "success",
                      text: "Got it. Similar topics and creators will rank higher.",
                    });
                    router.refresh();
                  })
                }
              >
                More like this
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const fd = new FormData();
                    fd.set("itemId", item.id);
                    fd.set("feedbackType", "not_relevant");
                    await submitResearchFeedbackAction(fd);
                    setActionMessage({
                      kind: "success",
                      text: "Removed. Similar recommendations will rank lower.",
                    });
                    router.refresh();
                  })
                }
              >
                Not relevant
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const fd = new FormData();
                    fd.set("itemId", item.id);
                    fd.set("feedbackType", "hide_creator");
                    await submitResearchFeedbackAction(fd);
                    setActionMessage({
                      kind: "success",
                      text: "Creator hidden from future recommendations.",
                    });
                    router.refresh();
                  })
                }
              >
                Hide creator
              </Button>
              <form action={addResearchItemToCanvasAction}>
                <input type="hidden" name="id" value={item.id} />
                <Button type="submit" size="sm" variant="ghost" disabled={pending}>
                  Add to Canvas
                </Button>
              </form>
            </div>
          </div>
        ) : null}

        {actionMessage ? (
          <p
            role="status"
            className={
              actionMessage.kind === "error"
                ? "rounded-lg border border-error/25 bg-error/10 p-3 text-sm text-error"
                : "rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm text-primary-container"
            }
          >
            {actionMessage.text}
          </p>
        ) : null}
      </div>
    </article>
  );
}
