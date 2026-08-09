"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createExperiment, type ExperimentActionState } from "./actions";

const initial: ExperimentActionState = {};

export function CreateExperimentForm() {
  const [state, action, pending] = useActionState(createExperiment, initial);

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow"
    >
      <div>
        <h2 className="font-headline text-xl font-semibold text-on-background">
          New experiment
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Capture a testable hypothesis. Variant analytics and auto-conclusions
          stay deferred — no fabricated metrics.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="hypothesis">Hypothesis</Label>
        <Textarea
          id="hypothesis"
          name="hypothesis"
          required
          rows={4}
          placeholder="If I open with a failure story, retention through 3s will beat my baseline."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="primaryVariable">Primary variable</Label>
          <Input
            id="primaryVariable"
            name="primaryVariable"
            placeholder="Hook type"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="primaryMetric">Primary metric</Label>
          <Input
            id="primaryMetric"
            name="primaryMetric"
            placeholder="3s retention"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="testPlan">Test plan</Label>
        <Textarea id="testPlan" name="testPlan" rows={3} />
      </div>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save experiment"}
      </Button>
    </form>
  );
}
