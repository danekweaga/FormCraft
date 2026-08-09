"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWatchlistAction, type ResearchActionState } from "./actions";

const initial: ResearchActionState = {};

export function WatchlistCreateForm() {
  const [state, action, pending] = useActionState(createWatchlistAction, initial);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="wl-name">Name</Label>
        <Input id="wl-name" name="name" placeholder="CS creators" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wl-desc">Description</Label>
        <Input id="wl-desc" name="description" placeholder="Optional" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create watchlist"}
      </Button>
      {state.error ? <p className="text-sm text-error">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-primary-container">{state.success}</p>
      ) : null}
    </form>
  );
}
