"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCompact } from "@/lib/my-content/growth-series";
import {
  STRATEGY_AUDIT_DIMENSIONS,
  buildStrategyAudits,
  type StrategyAuditDimension,
  type StrategySupportingPost,
} from "@/lib/my-content/strategy-audit";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import { cn } from "@/lib/utils";
import { savePostToIdeaBankAction } from "./actions";

function multiplierLabel(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2).replace(/\.00$/, "")}x`;
}

function barTone(multiplier: number | null): "up" | "mid" | "down" {
  if (multiplier == null) return "mid";
  if (multiplier >= 1.15) return "up";
  if (multiplier >= 0.95) return "mid";
  return "down";
}

function SupportingVideoCard({
  post,
  onPlay,
}: {
  post: StrategySupportingPost;
  onPlay: (post: StrategySupportingPost) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tone = barTone(post.multiplier);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
      <div className="relative aspect-[9/16] bg-surface-container-low">
        {post.thumbnailUrl ? (
          <Image
            src={post.thumbnailUrl}
            alt=""
            fill
            unoptimized
            sizes="180px"
            className="object-cover transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-secondary">
            No still
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <div className="mb-3 flex gap-2 p-2">
            <Button
              type="button"
              size="sm"
              className="pointer-events-auto"
              onClick={() => onPlay(post)}
              disabled={!post.embedUrl && !post.externalUrl}
            >
              Play
            </Button>
            <Button asChild size="sm" variant="outline" className="pointer-events-auto">
              <Link href={`/my-content/${post.id}`}>Analyze</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="pointer-events-auto bg-black/40 text-white hover:bg-black/60"
              disabled={pending || saved}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await savePostToIdeaBankAction(post.id);
                  if (result.error) setError(result.error);
                  else setSaved(true);
                })
              }
            >
              {saved ? "Saved" : pending ? "…" : "Idea bank"}
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 text-xs font-semibold text-on-background">
          {post.title}
        </p>
        <p className="text-[11px] capitalize text-secondary">
          {post.platform.replace(/_/g, " ")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant={
              tone === "up" ? "success" : tone === "down" ? "danger" : "warning"
            }
          >
            {multiplierLabel(post.multiplier)}
          </Badge>
          <Badge variant="primary">
            {post.views == null ? "—" : formatCompact(post.views)}
          </Badge>
          {post.engagementRate != null ? (
            <Badge variant="default">{post.engagementRate.toFixed(0)}%</Badge>
          ) : null}
        </div>
        {error ? <p className="text-[11px] text-error">{error}</p> : null}
      </div>
    </div>
  );
}

export function ContentStrategyAudit({
  posts,
  sampleLabel = "your last 30 videos",
}: {
  posts: ContentPostRow[];
  sampleLabel?: string;
}) {
  const [dimension, setDimension] =
    useState<StrategyAuditDimension>("topics");
  const audits = useMemo(
    () => buildStrategyAudits(posts, dimension),
    [posts, dimension],
  );
  const [selectedKey, setSelectedKey] = useState<string>("");
  const selected =
    audits.find((audit) => audit.key === (selectedKey || audits[0]?.key)) ??
    audits[0] ??
    null;
  const maxMultiplier = Math.max(
    1,
    ...audits.map((audit) => audit.multiplier ?? 0),
  );
  const [playing, setPlaying] = useState<StrategySupportingPost | null>(null);

  if (!selected) {
    return (
      <div className="rounded-lg border border-dashed border-outline-variant/30 p-8 text-sm text-secondary">
        Sync or classify more owned posts to unlock a content strategy audit.
      </div>
    );
  }

  const selectedTone = barTone(selected.multiplier);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-headline text-xl font-semibold text-on-background">
            Content Strategy Audit
          </h3>
          <p className="mt-1 text-sm text-secondary">
            Comprehensive insights based on {sampleLabel}.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-secondary">
          Performance by
          <select
            value={dimension}
            onChange={(event) => {
              setDimension(event.currentTarget.value as StrategyAuditDimension);
              setSelectedKey("");
            }}
            className="h-9 rounded-lg border border-primary-container/50 bg-surface-primary px-3 text-sm font-semibold text-on-background"
          >
            {STRATEGY_AUDIT_DIMENSIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.35fr)]">
        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-3">
          <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
            Performance by{" "}
            {STRATEGY_AUDIT_DIMENSIONS.find((item) => item.id === dimension)
              ?.label ?? dimension}
          </p>
          <div className="space-y-1.5">
            {audits.map((audit) => {
              const active = audit.key === selected.key;
              const tone = barTone(audit.multiplier);
              return (
                <button
                  key={audit.key}
                  type="button"
                  onClick={() => setSelectedKey(audit.key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-transparent bg-surface-primary"
                      : "border-transparent hover:bg-surface-container-low",
                  )}
                  style={
                    active
                      ? {
                          boxShadow:
                            tone === "up"
                              ? "inset 3px 0 0 #16a34a"
                              : tone === "down"
                                ? "inset 3px 0 0 #dc2626"
                                : "inset 3px 0 0 #ea580c",
                        }
                      : undefined
                  }
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-on-background">
                    {audit.label}
                  </span>
                  <div className="flex w-36 shrink-0 items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          tone === "up"
                            ? "bg-emerald-600"
                            : tone === "down"
                              ? "bg-red-600/80"
                              : "bg-orange-600",
                        )}
                        style={{
                          width: `${Math.max(4, ((audit.multiplier ?? 0) / maxMultiplier) * 100)}%`,
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        "w-10 text-right text-xs font-bold",
                        tone === "up"
                          ? "text-emerald-700"
                          : tone === "down"
                            ? "text-red-700"
                            : "text-orange-700",
                      )}
                    >
                      {multiplierLabel(audit.multiplier)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-5"
          style={{
            borderLeftWidth: 4,
            borderLeftColor:
              selectedTone === "up"
                ? "#16a34a"
                : selectedTone === "down"
                  ? "#dc2626"
                  : "#ea580c",
          }}
        >
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.18em]",
              selectedTone === "up"
                ? "text-emerald-700"
                : selectedTone === "down"
                  ? "text-red-700"
                  : "text-orange-700",
            )}
          >
            Selected{" "}
            {STRATEGY_AUDIT_DIMENSIONS.find((item) => item.id === dimension)
              ?.label ?? dimension}
          </p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <h4 className="font-headline text-2xl font-semibold text-on-background">
              {selected.label}
            </h4>
            <div className="flex gap-2">
              <Badge variant={selected.confidence === "low" ? "warning" : "primary"}>
                {selected.confidence} confidence
              </Badge>
              <Badge
                variant={
                  selectedTone === "up"
                    ? "success"
                    : selectedTone === "down"
                      ? "danger"
                      : "warning"
                }
              >
                {multiplierLabel(selected.multiplier)}
              </Badge>
            </div>
          </div>

          <ul className="mt-5 space-y-3">
            {selected.insights.map((insight) => (
              <li
                key={insight}
                className="flex gap-3 text-sm leading-relaxed text-secondary"
              >
                <span
                  className={cn(
                    "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                    selectedTone === "up"
                      ? "bg-emerald-600"
                      : selectedTone === "down"
                        ? "bg-red-600"
                        : "bg-orange-600",
                  )}
                />
                <span>{insight}</span>
              </li>
            ))}
          </ul>

          {selected.supportingPosts.length > 0 ? (
            <div className="mt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                Supporting videos
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {selected.supportingPosts.map((post) => (
                  <SupportingVideoCard
                    key={post.id}
                    post={post}
                    onPlay={setPlaying}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {playing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Watch video"
          onClick={() => setPlaying(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-surface-primary paper-shadow"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant/20 px-4 py-3">
              <p className="truncate text-sm font-semibold text-on-background">
                {playing.title}
              </p>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPlaying(null)}>
                Close
              </Button>
            </div>
            <div className="aspect-[9/16] bg-black">
              {playing.embedUrl ? (
                <iframe
                  title={playing.title}
                  src={playing.embedUrl}
                  className="h-full w-full"
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : playing.externalUrl ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/80">
                  <p>Embed unavailable for this platform link.</p>
                  <Button asChild>
                    <a href={playing.externalUrl} target="_blank" rel="noreferrer">
                      Open original
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-white/70">
                  No playable URL on this post.
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-outline-variant/20 p-3">
              <Button asChild size="sm" variant="outline">
                <Link href={`/my-content/${playing.id}`}>Open in My Content</Link>
              </Button>
              {playing.externalUrl ? (
                <Button asChild size="sm" variant="ghost">
                  <a href={playing.externalUrl} target="_blank" rel="noreferrer">
                    Open original
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
