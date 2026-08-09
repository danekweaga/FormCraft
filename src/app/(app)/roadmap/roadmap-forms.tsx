"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createMilestone,
  createRoadmap,
  type GrowthActionState,
} from "./actions";

const initial: GrowthActionState = {};

export function CreateRoadmapForm() {
  const [state, action, pending] = useActionState(createRoadmap, initial);

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow"
    >
      <div>
        <h2 className="font-headline text-xl font-semibold text-on-background">
          Create a roadmap
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Set a personal growth goal and current phase. Auto and AI milestones
          stay deferred — only manual entries for now.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="goal">Goal</Label>
        <Textarea
          id="goal"
          name="goal"
          required
          rows={3}
          placeholder="e.g. Reach 10k engaged followers with CS career content"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="currentPhase">Current phase</Label>
        <Input
          id="currentPhase"
          name="currentPhase"
          defaultValue="foundation"
          maxLength={80}
        />
      </div>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save roadmap"}
      </Button>
    </form>
  );
}

export function CreateMilestoneForm({ roadmapId }: { roadmapId: string }) {
  const [state, action, pending] = useActionState(createMilestone, initial);

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5"
    >
      <input type="hidden" name="roadmapId" value={roadmapId} />
      <h3 className="font-headline text-lg font-semibold text-on-background">
        Add milestone
      </h3>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required maxLength={200} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            defaultValue="general"
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deadline">Deadline</Label>
          <Input id="deadline" name="deadline" type="date" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Adding…" : "Add milestone"}
      </Button>
    </form>
  );
}
