"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateDisplayName,
  type UpdateDisplayNameState,
} from "./actions";

const initialState: UpdateDisplayNameState = {};

export function SettingsForm({ displayName }: { displayName: string }) {
  const [state, formAction, isPending] = useActionState(
    updateDisplayName,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          name="display_name"
          type="text"
          defaultValue={displayName}
          autoComplete="name"
          required
        />
      </div>

      {state.error ? (
        <p className="text-sm text-error">{state.error}</p>
      ) : null}

      {state.success ? (
        <p className="text-sm text-primary-container">
          Profile updated successfully.
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
