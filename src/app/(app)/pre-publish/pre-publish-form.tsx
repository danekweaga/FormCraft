"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPrePublishReview, type PrePublishActionState } from "./actions";

const initial: PrePublishActionState = {};

export function PrePublishForm() {
  const [state, action, pending] = useActionState(createPrePublishReview, initial);

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow"
    >
      <div>
        <h2 className="font-headline text-xl font-semibold text-on-background">
          Review a script
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Stores a Pre-Publish review with a heuristic stub result. Full LLM
          stress-testing is deferred.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sourceRef">Optional label</Label>
        <Input id="sourceRef" name="sourceRef" placeholder="Draft title" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inputText">Script</Label>
        <Textarea id="inputText" name="inputText" required rows={12} />
      </div>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Reviewing…" : "Run stub review"}
      </Button>
    </form>
  );
}
