"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateWeeklyReviewAction } from "./actions";

export function GenerateWeeklyReviewButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await generateWeeklyReviewAction();
            if (result.error) setError(result.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Generating…" : "Generate weekly review"}
      </Button>
      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
