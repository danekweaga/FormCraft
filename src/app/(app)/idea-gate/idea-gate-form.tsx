"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { evaluateIdea, type IdeaGateActionState } from "./actions";

const initial: IdeaGateActionState = {};

export function IdeaGateForm() {
  const [state, action, pending] = useActionState(evaluateIdea, initial);

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow"
    >
      <div>
        <h2 className="font-headline text-xl font-semibold text-on-background">
          Gate an idea
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Paste a concept for a heuristic recommendation (pursue / reshape /
          park / kill). Full AI evaluation is deferred.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ideaText">Idea</Label>
        <Textarea
          id="ideaText"
          name="ideaText"
          required
          rows={6}
          placeholder="For CS students who freeze on applications: how to ship one portfolio project that gets replies."
        />
      </div>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Evaluating…" : "Evaluate idea"}
      </Button>
    </form>
  );
}
