"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { outlierLabelDisplay } from "@/lib/research/outliers";
import type { OutlierLabel } from "@/lib/research/outliers";
import {
  analyzeResearchItemAction,
  generateIdeasFromResearchAction,
  submitResearchFeedbackAction,
  toggleResearchSavedAction,
  trackCreatorFromItemAction,
} from "./actions";

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
};

function freshnessLabel(iso: string | null) {
  if (!iso) return "Freshness unknown";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `Updated ${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `Updated ${hours}h ago`;
  return `Updated ${Math.round(hours / 24)}d ago`;
}

export function ResearchItemCard({
  item,
  watchlists = [],
}: {
  item: ResearchCardItem;
  watchlists?: Array<{ id: string; name: string }>;
}) {
  const [pending, start] = useTransition();
  const analysis = item.analysis ?? {};
  const reasons = Array.isArray(analysis.whyItMayWork)
    ? (analysis.whyItMayWork as string[])
    : [];
  const principles = Array.isArray(analysis.reusablePattern)
    ? (analysis.reusablePattern as string[])
    : typeof analysis.reusablePattern === "string"
      ? [analysis.reusablePattern]
      : [];
  const embed =
    item.platform === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.external_id)}`
      : null;

  return (
    <Card className="overflow-hidden border-outline-variant/20 bg-surface-primary paper-shadow">
      {embed ? (
        <div className="aspect-video bg-black">
          <iframe
            src={embed}
            title={item.title ?? "Research video"}
            className="h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : item.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnail_url}
          alt=""
          className="aspect-video w-full object-cover"
        />
      ) : null}
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">{item.platform}</Badge>
          <Badge variant="default">{item.source.replace(/_/g, " ")}</Badge>
          {item.outlier_score != null ? (
            <Badge variant="success">
              {Number(item.outlier_score).toFixed(1)}×{" "}
              {outlierLabelDisplay(item.outlier_label as OutlierLabel | null)}
            </Badge>
          ) : (
            <Badge variant="warning">Unscored</Badge>
          )}
          {item.saved ? <Badge variant="primary">Saved</Badge> : null}
          {item.analysis_model ? (
            <Badge variant="default">Analyzed</Badge>
          ) : (
            <Badge variant="warning">Not analyzed</Badge>
          )}
          {item.personalFit ? (
            <Badge variant="primary">Fit: {item.personalFit}</Badge>
          ) : null}
        </div>
        <CardTitle className="mt-2 text-lg">
          {item.title || item.hook_text || "Untitled reference"}
        </CardTitle>
        <CardDescription>
          {item.creator_name ?? "Creator unavailable"}
          {item.views != null ? ` · ${item.views.toLocaleString()} views` : ""}
          {item.likes != null ? ` · ${item.likes.toLocaleString()} likes` : ""}
          {item.creator_followers != null
            ? ` · ${item.creator_followers.toLocaleString()} followers`
            : ""}
          {item.duration_seconds != null
            ? ` · ${Math.round(Number(item.duration_seconds))}s`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-lg bg-surface-container-lowest p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
            Observed
          </p>
          <p className="mt-2 text-secondary">
            Outlier:{" "}
            {item.outlier_score != null
              ? `${Number(item.outlier_score).toFixed(1)}×`
              : "n/a"}{" "}
            · Confidence: {item.baseline_confidence ?? "n/a"} · Compared with:{" "}
            {item.baseline_sample_size ?? "n/a"} posts · Basis:{" "}
            {item.score_basis?.replace(/_/g, " ") ?? "unavailable"}
          </p>
          <p className="mt-1 text-xs text-secondary">
            {freshnessLabel(item.data_freshness_at)}
            {item.collection_method
              ? ` · ${item.collection_method}`
              : ""}
          </p>
          <p className="mt-3 font-semibold text-on-background">Hook preview</p>
          <p className="mt-1 text-secondary">
            {item.hook_text ?? "Not enough evidence"}
          </p>
          <p className="mt-3 font-semibold text-on-background">Topic</p>
          <p className="mt-1 text-secondary">{item.topic ?? "Unclassified"}</p>
        </div>

        {item.whyRelevant && item.whyRelevant.length > 0 ? (
          <div className="rounded-lg border border-outline-variant/15 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
              Why this is relevant to you
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary">
              {item.whyRelevant.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {reasons.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
              AI interpretation
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-secondary">
              Interpretation only — not proof of causation.
            </p>
          </div>
        ) : null}

        {principles.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
              Repeatable principles
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary">
              {principles.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={item.external_url} target="_blank" rel="noreferrer">
              Open original
            </a>
          </Button>
          {item.external_creator_id ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/research/creators/${item.external_creator_id}`}>
                Creator
              </Link>
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await analyzeResearchItemAction(
                  (() => {
                    const fd = new FormData();
                    fd.set("id", item.id);
                    return fd;
                  })(),
                );
              })
            }
          >
            Analyze
          </Button>
          <Button
            size="sm"
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
            Generate ideas → Idea Gate
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
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const fd = new FormData();
                fd.set("itemId", item.id);
                fd.set("feedbackType", "not_relevant");
                await submitResearchFeedbackAction(fd);
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
              })
            }
          >
            Hide creator
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/canvas">Add to Canvas (stub)</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
