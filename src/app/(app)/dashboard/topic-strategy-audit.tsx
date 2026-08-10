"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCompact } from "@/lib/my-content/growth-series";
import type { DashboardTopicAudit } from "@/lib/my-content/account-dashboard";
import { cn } from "@/lib/utils";

function multiplierLabel(value: number | null): string {
  return value === null ? "Unscored" : `${value.toFixed(2)}×`;
}

export function TopicStrategyAudit({
  audits,
}: {
  audits: DashboardTopicAudit[];
}) {
  const [selectedTopic, setSelectedTopic] = useState(audits[0]?.topic ?? "");
  const selected =
    audits.find((audit) => audit.topic === selectedTopic) ?? audits[0] ?? null;
  const maxMultiplier = Math.max(1, ...audits.map((audit) => audit.multiplier ?? 0));

  if (!selected) {
    return (
      <div className="rounded-lg border border-dashed border-outline-variant/30 p-8 text-sm text-secondary">
        Classify more synced posts to unlock a topic-level strategy audit.
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.35fr)]">
      <div className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
          Performance by topic
        </p>
        <div className="space-y-2">
          {audits.map((audit) => {
            const active = audit.topic === selected.topic;
            const positive = (audit.multiplier ?? 0) >= 1;
            return (
              <button
                key={audit.topic}
                type="button"
                onClick={() => setSelectedTopic(audit.topic)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  active
                    ? "border-primary-container bg-primary-container/5"
                    : "border-transparent hover:bg-surface-container-low",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-on-background">
                    {audit.topic}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-bold",
                      positive ? "text-primary" : "text-error",
                    )}
                  >
                    {multiplierLabel(audit.multiplier)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        positive ? "bg-primary-container" : "bg-error/70",
                      )}
                      style={{
                        width: `${Math.max(3, ((audit.multiplier ?? 0) / maxMultiplier) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-secondary">
                    {audit.postCount} post{audit.postCount === 1 ? "" : "s"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border-l-4 border-primary-container bg-surface-container-lowest p-5 paper-shadow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Selected topic
            </p>
            <h3 className="mt-2 font-headline text-xl font-semibold text-on-background">
              {selected.topic}
            </h3>
          </div>
          <div className="flex gap-2">
            <Badge variant={selected.confidence === "low" ? "warning" : "primary"}>
              {selected.confidence} confidence
            </Badge>
            <Badge>{multiplierLabel(selected.multiplier)} baseline</Badge>
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {selected.insights.map((insight) => (
            <li key={insight} className="flex gap-3 text-sm leading-relaxed text-secondary">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-container" />
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
                <Link
                  key={post.id}
                  href={`/my-content/${post.id}`}
                  className="group overflow-hidden rounded-lg border border-outline-variant/20 bg-surface hover:border-primary-container/50"
                >
                  <div className="relative aspect-[4/5] bg-surface-container-low">
                    {post.thumbnailUrl ? (
                      <Image
                        src={post.thumbnailUrl}
                        alt=""
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 220px"
                        className="object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-secondary">
                        Preview unavailable
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-xs font-semibold text-on-background">
                      {post.title}
                    </p>
                    <p className="mt-1 text-[11px] capitalize text-secondary">
                      {post.platform.replace(/_/g, " ")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="primary">
                        {post.views === null ? "Views unavailable" : `${formatCompact(post.views)} views`}
                      </Badge>
                      {post.engagementRate !== null ? (
                        <Badge>{post.engagementRate.toFixed(1)}% eng.</Badge>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
