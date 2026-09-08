"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createMilestone,
  createRoadmap,
  saveFollowerGoal,
  refreshRoadmapFollowers,
  updateMilestoneStatus,
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
          Set your direction, then connect a follower goal and track your checkpoints.
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

export function FollowerGoalForm({ roadmapId, target, current, connectionId, accounts }: {
  roadmapId: string; target: number; current: number | null; connectionId: string | null;
  accounts: Array<{ id: string; label: string }>;
}) {
  const [state, action, pending] = useActionState(saveFollowerGoal, initial);
  const [refreshState, refresh, refreshing] = useActionState(refreshRoadmapFollowers, initial);
  const selectedConnectionId = connectionId ?? accounts[0]?.id ?? "";
  return <div className="space-y-4">
    {accounts.length ? <form action={action} className="grid gap-4">
      <input type="hidden" name="roadmapId" value={roadmapId} />
      <label className="space-y-1.5 text-sm font-bold">Final checkpoint<Input name="target" type="number" min={1} max={100000000} defaultValue={target} required /></label>
      <label className="space-y-1.5 text-sm font-bold">Account to track<select name="connectionId" defaultValue={selectedConnectionId} className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-2.5 font-medium">{accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
      <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900"><p className="text-xs font-black uppercase tracking-[0.14em]">Automatically synced</p><p className="mt-1 text-2xl font-black">{current?.toLocaleString() ?? "Waiting for first sync"}</p><p className="mt-1 text-xs font-medium">FormCraft reads this count from your connected account. It cannot be edited manually.</p></div>
      <Button className="w-full" disabled={pending}>{pending ? "Saving…" : "Save checkpoint settings"}</Button>
      {state.error ? <p role="alert" className="text-sm text-error">{state.error}</p> : state.success ? <p role="status" className="text-sm">Goal updated.</p> : null}
    </form> : <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950">Connect Instagram in Connections and enable “Use for roadmap.” Your follower count will then update automatically.</div>}
    {selectedConnectionId ? <form action={refresh} className="space-y-2"><input type="hidden" name="roadmapId" value={roadmapId} /><input type="hidden" name="connectionId" value={selectedConnectionId} /><Button className="w-full" variant="outline" disabled={refreshing}>{refreshing ? "Checking your account…" : "↻ Check followers now"}</Button>{refreshState.error ? <p role="alert" className="text-sm text-error">{refreshState.error}</p> : refreshState.success ? <p role="status" className="text-sm font-bold text-emerald-700">Follower count and roadmap position updated.</p> : null}</form> : null}
  </div>;
}

export function MilestoneStatusForm({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(updateMilestoneStatus, initial);
  return <form action={action} className="mt-3 flex flex-wrap items-center gap-2"><input type="hidden" name="id" value={id} /><select aria-label="Milestone status" name="status" defaultValue={status} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-2 text-sm font-bold">{["not_started", "in_progress", "done", "blocked", "skipped"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><Button size="sm" variant="outline" disabled={pending}>{pending ? "Saving…" : "Update"}</Button>{state.error ? <p role="alert">{state.error}</p> : null}</form>;
}

export function CreateMilestoneForm({ roadmapId }: { roadmapId: string }) {
  const [state, action, pending] = useActionState(createMilestone, initial);

  return (
    <form
      action={action}
      className="space-y-4"
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
