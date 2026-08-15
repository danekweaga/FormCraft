"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runContentIntelligenceJob } from "./actions";

function friendlyIntelligenceError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Intelligence pass failed.";
  if (
    /unexpected response was received from the server/i.test(message) ||
    /failed to fetch/i.test(message) ||
    /networkerror/i.test(message)
  ) {
    return "The pass timed out before finishing. FormCraft now classifies a few posts per run — click Run again to continue.";
  }
  return message;
}

export function RunIntelligenceButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);

  return (
    <div className="max-w-sm text-right">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            setDetails([]);
            try {
              const result = await runContentIntelligenceJob();
              if (result.error) {
                setMessage(result.error);
                return;
              }
              setMessage(
                `Classified ${result.classified ?? 0} · lessons ${result.lessons ?? 0} · insights ${result.insights ?? 0}`,
              );
              setDetails(result.details ?? []);
              router.refresh();
            } catch (error) {
              setMessage(friendlyIntelligenceError(error));
            }
          })
        }
      >
        {pending ? "Running…" : "Run intelligence pass"}
      </Button>
      {message ? (
        <p className="mt-2 text-left text-xs font-medium text-on-background">
          {message}
        </p>
      ) : null}
      {details.length > 0 ? (
        <ul className="mt-1 list-disc space-y-1 pl-4 text-left text-[11px] leading-snug text-secondary">
          {details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
