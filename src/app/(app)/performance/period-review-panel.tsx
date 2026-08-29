"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContentPostRow } from "@/lib/my-content/schemas";
import {
  buildPeriodReview,
  DEFAULT_PERIOD_REVIEW_PREFS,
  type PeriodKind,
  type PeriodReviewPrefs,
  type ReviewedPost,
} from "@/lib/my-content/period-review";

const PREFS_KEY = "formcraft.period-review.prefs";

function loadPrefs(): PeriodReviewPrefs {
  if (typeof window === "undefined") return DEFAULT_PERIOD_REVIEW_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PERIOD_REVIEW_PREFS;
    const parsed = JSON.parse(raw) as Partial<PeriodReviewPrefs>;
    return {
      ...DEFAULT_PERIOD_REVIEW_PREFS,
      ...parsed,
      enjoymentTopics:
        parsed.enjoymentTopics ?? DEFAULT_PERIOD_REVIEW_PREFS.enjoymentTopics,
      growthTopics:
        parsed.growthTopics ?? DEFAULT_PERIOD_REVIEW_PREFS.growthTopics,
    };
  } catch {
    return DEFAULT_PERIOD_REVIEW_PREFS;
  }
}

function formatHour(hour: number | null): string {
  if (hour === null) return "—";
  const suffix = hour >= 12 ? "pm" : "am";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${suffix}`;
}

function PostCard({ post }: { post: ReviewedPost }) {
  return (
    <li className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
      <div className="flex gap-3">
        {post.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnailUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-xs text-secondary">
            No still
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                post.tone === "win"
                  ? "success"
                  : post.tone === "weak"
                    ? "default"
                    : "primary"
              }
            >
              {post.tone === "win"
                ? "Winner"
                : post.tone === "weak"
                  ? "Soft"
                  : "Mixed"}
            </Badge>
            <Badge variant="primary">{post.topicKind}</Badge>
            {post.inPeakWindow === false ? (
              <Badge variant="warning">Off-peak</Badge>
            ) : null}
            {post.inPeakWindow === true ? (
              <Badge variant="demo">Peak hour</Badge>
            ) : null}
          </div>
          <p className="mt-2 font-medium text-on-background">{post.title}</p>
          <p className="mt-1 text-xs text-secondary">
            {post.views != null
              ? `${post.views.toLocaleString()} views`
              : "Views unavailable"}
            {post.viewsVsMedian != null
              ? ` · ${post.viewsVsMedian.toFixed(1)}× median`
              : ""}
            {post.hourLocal != null
              ? ` · posted ${formatHour(post.hourLocal)}`
              : ""}
            {` · ${post.topicLabel}`}
          </p>
          <ul className="mt-2 space-y-1">
            {post.reasons.map((reason) => (
              <li key={reason} className="text-xs leading-relaxed text-secondary">
                {reason}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/my-content`}>Open in My Content</Link>
            </Button>
            {post.externalUrl ? (
              <Button asChild size="sm" variant="ghost">
                <a href={post.externalUrl} target="_blank" rel="noreferrer">
                  View post
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

export function PeriodReviewPanel({ posts }: { posts: ContentPostRow[] }) {
  const [period, setPeriod] = useState<PeriodKind>("week");
  const [prefs, setPrefs] = useState<PeriodReviewPrefs>(DEFAULT_PERIOD_REVIEW_PREFS);
  const [showPrefs, setShowPrefs] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setPrefs(loadPrefs()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const review = useMemo(
    () => buildPeriodReview({ posts, period, prefs }),
    [posts, period, prefs],
  );

  function savePrefs(next: PeriodReviewPrefs) {
    setPrefs(next);
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota / private mode failures.
    }
  }

  return (
    <section className="rounded-xl border border-outline-variant/20 bg-surface-primary paper-shadow">
      <div className="border-b border-outline-variant/15 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-headline text-lg font-semibold text-on-background">
              Period review
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-secondary">
              What did well, what lagged, and why — with your enjoyment lane and
              peak hours factored in. Goal: remake winners, not punish joy posts.
            </p>
          </div>
          <div className="flex rounded-full bg-surface-container-low p-1">
            {(["week", "month"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={
                  period === value
                    ? "rounded-full bg-surface-primary px-3.5 py-1.5 text-xs font-semibold capitalize text-on-background paper-shadow"
                    : "rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize text-secondary hover:text-on-background"
                }
              >
                This {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-secondary">
            {review.postCount} posts in the last {review.days} days
            {review.medianViews != null
              ? ` · median ${Math.round(review.medianViews).toLocaleString()} views`
              : ""}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowPrefs((open) => !open)}
          >
            {showPrefs ? "Hide preferences" : "Peak hours & topics"}
          </Button>
        </div>

        {showPrefs ? (
          <div className="grid gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="peak_hours">Peak hours (local)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="peak_hours"
                  type="number"
                  min={0}
                  max={23}
                  value={prefs.peakHoursStart}
                  onChange={(event) =>
                    savePrefs({
                      ...prefs,
                      peakHoursStart: Number(event.currentTarget.value),
                    })
                  }
                  className="w-20 rounded-lg border border-outline-variant/30 bg-surface-primary px-2 py-1.5 text-sm"
                />
                <span className="text-sm text-secondary">to</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={prefs.peakHoursEnd}
                  onChange={(event) =>
                    savePrefs({
                      ...prefs,
                      peakHoursEnd: Number(event.currentTarget.value),
                    })
                  }
                  className="w-20 rounded-lg border border-outline-variant/30 bg-surface-primary px-2 py-1.5 text-sm"
                />
              </div>
              <p className="text-xs text-secondary">
                Default 9–12 in {prefs.timeZone}. Off-peak posts are flagged as a
                hypothesis only.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enjoyment_topics">Enjoyment topics</Label>
              <Textarea
                id="enjoyment_topics"
                rows={3}
                value={prefs.enjoymentTopics.join(", ")}
                onChange={(event) =>
                  savePrefs({
                    ...prefs,
                    enjoymentTopics: event.currentTarget.value
                      .split(/[\n,]+/)
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="self improvement, mindset, yap"
              />
              <Label htmlFor="growth_topics">Growth / CS topics</Label>
              <Textarea
                id="growth_topics"
                rows={3}
                value={prefs.growthTopics.join(", ")}
                onChange={(event) =>
                  savePrefs({
                    ...prefs,
                    growthTopics: event.currentTarget.value
                      .split(/[\n,]+/)
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="computer science, coding, internship, AI"
              />
            </div>
          </div>
        ) : null}

        {review.postCount === 0 ? (
          <p className="text-sm text-secondary">
            No owned posts in this window yet. Sync Instagram or widen to the
            month tab after you publish.
          </p>
        ) : (
          <>
            {review.hypotheses.length > 0 ? (
              <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  Read this first
                </p>
                <ul className="mt-2 space-y-2">
                  {review.hypotheses.map((item) => (
                    <li
                      key={item}
                      className="text-sm leading-relaxed text-on-background"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-secondary">
                  {review.postingTime.caveat}
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
              {review.topicSplit.map((row) => (
                <div
                  key={row.kind}
                  className="rounded-xl border border-outline-variant/15 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                    {row.kind} lane
                  </p>
                  <p className="mt-2 font-headline text-2xl font-bold text-on-background">
                    {row.averageViews != null
                      ? Math.round(row.averageViews).toLocaleString()
                      : "—"}
                  </p>
                  <p className="text-xs text-secondary">
                    avg views · {row.postCount} post
                    {row.postCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-secondary">
                    {row.note}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-outline-variant/15 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  Peak window posts
                </p>
                <p className="mt-2 font-headline text-xl font-bold text-on-background">
                  {review.postingTime.inPeak.averageViews != null
                    ? Math.round(
                        review.postingTime.inPeak.averageViews,
                      ).toLocaleString()
                    : "—"}{" "}
                  <span className="text-sm font-medium text-secondary">
                    avg views · {review.postingTime.inPeak.postCount} posts
                  </span>
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant/15 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  Off-peak posts
                </p>
                <p className="mt-2 font-headline text-xl font-bold text-on-background">
                  {review.postingTime.offPeak.averageViews != null
                    ? Math.round(
                        review.postingTime.offPeak.averageViews,
                      ).toLocaleString()
                    : "—"}{" "}
                  <span className="text-sm font-medium text-secondary">
                    avg views · {review.postingTime.offPeak.postCount} posts
                  </span>
                </p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div>
                <h3 className="font-headline text-base font-semibold text-on-background">
                  Best in this {period}
                </h3>
                <p className="mt-1 text-xs text-secondary">
                  Remake these structures. Good posts can still win at any hour.
                </p>
                <ul className="mt-3 space-y-3">
                  {review.winners.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-headline text-base font-semibold text-on-background">
                  Soft performers
                </h3>
                <p className="mt-1 text-xs text-secondary">
                  Soft ≠ bad if it was a joy yap. Look for fixable causes first.
                </p>
                {review.weakest.length === 0 ? (
                  <p className="mt-3 text-sm text-secondary">
                    Nothing clearly under the median in this window.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {review.weakest.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {(review.makeMoreOf.length > 0 || review.keepForJoy.length > 0) && (
              <div className="grid gap-4 lg:grid-cols-2">
                {review.makeMoreOf.length > 0 ? (
                  <div className="rounded-xl border border-outline-variant/15 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                      Make more like
                    </p>
                    <ul className="mt-2 space-y-2">
                      {review.makeMoreOf.map((item) => (
                        <li
                          key={item}
                          className="text-sm leading-relaxed text-on-background"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {review.keepForJoy.length > 0 ? (
                  <div className="rounded-xl border border-outline-variant/15 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                      Keep for joy
                    </p>
                    <ul className="mt-2 space-y-2">
                      {review.keepForJoy.map((item) => (
                        <li
                          key={item}
                          className="text-sm leading-relaxed text-on-background"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
