"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export type NicheFeedScanSummary = {
  discovered?: number;
  eligible?: number;
  retained?: number;
  at?: string;
};

export function NicheFeedRefresh({
  pending,
  lastError,
  lastStats,
}: {
  pending: boolean;
  lastError?: string | null;
  lastStats?: NicheFeedScanSummary | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!pending) return;
    const first = window.setTimeout(() => router.refresh(), 8_000);
    const second = window.setTimeout(() => router.refresh(), 22_000);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [pending, router]);

  if (lastError) {
    return (
      <p className="mb-4 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-on-background">
        Last For You scan failed: {lastError}. Open Research again to retry —
        FormCraft cleared the cooldown so the next visit can pull.
      </p>
    );
  }

  if (pending) {
    return (
      <p className="mb-4 rounded-xl border border-outline-variant/20 bg-surface-primary px-4 py-3 text-sm text-secondary">
        Checking for new videos in your niche since the last scan…
      </p>
    );
  }

  if (
    lastStats &&
    typeof lastStats.discovered === "number" &&
    typeof lastStats.retained === "number"
  ) {
    return (
      <p className="mb-4 text-xs text-secondary">
        Last niche pull: {lastStats.discovered} found · {lastStats.retained}{" "}
        kept
        {lastStats.at
          ? ` · ${new Date(lastStats.at).toLocaleString()}`
          : ""}
        .
      </p>
    );
  }

  return null;
}
