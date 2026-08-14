"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function NicheFeedRefresh({ pending }: { pending: boolean }) {
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

  if (!pending) return null;

  return (
    <p className="mb-4 rounded-xl border border-outline-variant/20 bg-surface-primary px-4 py-3 text-sm text-secondary">
      Checking for new videos in your niche since the last scan…
    </p>
  );
}
