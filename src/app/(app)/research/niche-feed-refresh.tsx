"use client";

import { useEffect, useState } from "react";
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
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    let active = true;
    void fetch("/api/research/refresh", {
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (!response.ok) {
          throw new Error(payload?.error || `Refresh failed (${response.status})`);
        }
        if (active) router.refresh();
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        setRequestError(
          error instanceof Error ? error.message : "Feed refresh failed.",
        );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [pending, router]);

  if (requestError || lastError) {
    return (
      <p className="mb-4 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-on-background">
        Last For You scan failed: {requestError || lastError}. Reload Research
        to retry; saved videos are unaffected.
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
