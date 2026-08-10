"use client";

import { useMemo, useState, useTransition } from "react";
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

export type CompareCreatorOption = {
  id: string;
  label: string;
  platform: string;
};

export type CompareCreatorResult = {
  id: string;
  displayName: string;
  platform: string;
  followerCount: number | null;
  postCount: number;
  medianViews: number | null;
  baselineConfidence: string;
  strongestOutlier: number | null;
  outlierLabel: string | null;
  topics: string[];
  hooks: string[];
  formats: string[];
  postsPerWeek: number | null;
};

export function CreatorComparePanel({
  creators,
  initialResults = [],
}: {
  creators: CompareCreatorOption[];
  initialResults?: CompareCreatorResult[];
}) {
  const [selected, setSelected] = useState<string[]>(
    creators.slice(0, 2).map((c) => c.id),
  );
  const [results, setResults] = useState(initialResults);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canCompare = selected.length >= 2 && selected.length <= 5;

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 5
          ? prev
          : [...prev, id],
    );
  }

  const selectedLabels = useMemo(
    () =>
      selected
        .map((id) => creators.find((c) => c.id === id)?.label)
        .filter(Boolean),
    [selected, creators],
  );

  return (
    <div className="space-y-6">
      <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
        <CardHeader>
          <CardTitle>Compare creators</CardTitle>
          <CardDescription>
            Select 2–5 tracked creators. Comparison uses creator-relative
            outliers from posts FormCraft already stored — not raw view
            contests.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {creators.length < 2 ? (
            <p className="text-sm text-secondary">
              Track at least two creators from Research cards first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {creators.map((creator) => {
                const on = selected.includes(creator.id);
                return (
                  <button
                    key={creator.id}
                    type="button"
                    onClick={() => toggle(creator.id)}
                    className={
                      on
                        ? "rounded-full bg-primary-container px-3 py-1.5 text-sm font-semibold text-white"
                        : "rounded-full border border-outline-variant/30 px-3 py-1.5 text-sm text-secondary"
                    }
                  >
                    {creator.label} · {creator.platform}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={!canCompare || pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await fetch("/api/research/compare-creators", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ creatorIds: selected }),
                  });
                  const body = (await res.json()) as {
                    results?: CompareCreatorResult[];
                    error?: string;
                  };
                  if (!res.ok) {
                    setError(body.error ?? "Compare failed");
                    return;
                  }
                  setResults(body.results ?? []);
                })
              }
            >
              {pending ? "Comparing…" : "Compare selected"}
            </Button>
            <p className="text-xs text-secondary">
              {selectedLabels.join(" · ") || "None selected"}
            </p>
          </div>
          {error ? <p className="text-sm text-error">{error}</p> : null}
        </CardContent>
      </Card>

      {results.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {results.map((row) => (
            <Card
              key={row.id}
              className="border-outline-variant/20 bg-surface-primary paper-shadow"
            >
              <CardHeader>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">{row.platform}</Badge>
                  <Badge variant="primary">
                    Confidence {row.baselineConfidence}
                  </Badge>
                </div>
                <CardTitle className="text-base">
                  <Link
                    href={`/research/creators/${row.id}`}
                    className="hover:underline"
                  >
                    {row.displayName}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {row.postCount} stored posts
                  {row.postsPerWeek != null
                    ? ` · ~${row.postsPerWeek.toFixed(1)}/week`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-secondary">
                <p>
                  Median views:{" "}
                  {row.medianViews != null
                    ? Math.round(row.medianViews).toLocaleString()
                    : "n/a"}
                </p>
                <p>
                  Strongest outlier:{" "}
                  {row.strongestOutlier != null
                    ? `${row.strongestOutlier.toFixed(1)}× (${row.outlierLabel ?? "unscored"})`
                    : "n/a"}
                </p>
                <p>Topics: {row.topics.join(" · ") || "—"}</p>
                <p>Formats: {row.formats.join(" · ") || "—"}</p>
                <p>Hooks: {row.hooks.slice(0, 2).join(" · ") || "—"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
