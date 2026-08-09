"use client";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-primary p-8 paper-shadow">
      <h2 className="font-headline text-2xl font-semibold">Something went wrong</h2>
      <p className="mt-2 text-secondary">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
