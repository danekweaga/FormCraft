"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { pasteAudienceComments, type AudienceActionState } from "./actions";

const initial: AudienceActionState = {};

export function PasteCommentsForm() {
  const [state, action, pending] = useActionState(pasteAudienceComments, initial);

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow"
    >
      <div>
        <h2 className="font-headline text-xl font-semibold text-on-background">
          Paste comments
        </h2>
        <p className="mt-1 text-sm text-secondary">
          One comment per line. Manual ingest only — connected social sync and
          auto-clustering are deferred.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="comments">Comments</Label>
        <Textarea
          id="comments"
          name="comments"
          required
          rows={10}
          placeholder={"This is exactly my problem\nHow do I start with no portfolio?"}
        />
      </div>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-secondary">
          Stored {state.inserted ?? 0} comment
          {(state.inserted ?? 0) === 1 ? "" : "s"}.
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save comments"}
      </Button>
    </form>
  );
}
