"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { RemixIngredient } from "@/lib/my-content/dashboard";

function buildPairs(topics: RemixIngredient[], hooks: RemixIngredient[]) {
  return topics.flatMap((topic) =>
    hooks
      .filter((hook) => hook.postId !== topic.postId || hooks.length === 1)
      .map((hook) => ({ topic, hook })),
  );
}

export function ContentRemix({
  topics,
  hooks,
}: {
  topics: RemixIngredient[];
  hooks: RemixIngredient[];
}) {
  const pairs = buildPairs(topics, hooks);
  const [pairIndex, setPairIndex] = useState(0);
  const pair = pairs[pairIndex % Math.max(1, pairs.length)] ?? null;

  if (!pair) {
    return (
      <p className="text-sm text-secondary">
        Classify and sync more posts to unlock evidence-based hook/topic remixes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Proven topic</p>
          <p className="mt-2 font-headline text-lg font-semibold text-on-background">{pair.topic.text}</p>
          <Link href={`/my-content/${pair.topic.postId}`} className="mt-2 block text-xs text-primary-container hover:underline">
            Source · {pair.topic.views?.toLocaleString() ?? "—"} views
          </Link>
        </div>
        <span className="text-center text-2xl text-secondary">+</span>
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Proven hook</p>
          <p className="mt-2 font-headline text-lg font-semibold text-on-background">{pair.hook.text}</p>
          <Link href={`/my-content/${pair.hook.postId}`} className="mt-2 block text-xs text-primary-container hover:underline">
            Source · {pair.hook.views?.toLocaleString() ?? "—"} views
          </Link>
        </div>
      </div>
      <p className="text-sm text-secondary">
        Draft direction: use “{pair.hook.text}” to introduce a new take on {pair.topic.text}. Treat this as a testable combination, not a guaranteed winner.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          if (pairs.length <= 1) return;
          const next = Math.floor(Math.random() * pairs.length);
          setPairIndex(next === pairIndex ? (next + 1) % pairs.length : next);
        }}
      >
        Shuffle combination
      </Button>
    </div>
  );
}
