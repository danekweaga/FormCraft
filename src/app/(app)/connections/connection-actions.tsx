"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  disconnectConnection,
  refreshAllConnectedAccounts,
  syncConnectionNow,
  updateConnectionSettings,
  type ConnectionActionState,
} from "./actions";

const initial: ConnectionActionState = {};

function ActionFeedback({ state }: { state: ConnectionActionState }) {
  return (
    <>
      {state.error ? (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="mt-1 text-xs text-secondary">{state.success}</p>
      ) : null}
    </>
  );
}

export function SyncNowButton({
  connectionId,
  disabled,
  label = "Refresh posts & followers",
}: {
  connectionId: string;
  disabled?: boolean;
  label?: string;
}) {
  const [state, action, pending] = useActionState(syncConnectionNow, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="connectionId" value={connectionId} />
      <Button type="submit" size="sm" disabled={pending || disabled}>
        {pending ? "Refreshing…" : label}
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function RefreshAllConnectedButton({
  disabled,
  size = "sm",
  label = "Refresh posts & followers",
}: {
  disabled?: boolean;
  size?: "sm" | "default";
  label?: string;
}) {
  const [state, action, pending] = useActionState(
    refreshAllConnectedAccounts,
    initial,
  );
  return (
    <form action={action} className="inline">
      <Button
        type="submit"
        size={size}
        variant="outline"
        disabled={pending || disabled}
      >
        {pending ? "Refreshing…" : label}
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function DisconnectPanel({ connectionId }: { connectionId: string }) {
  const [state, action, pending] = useActionState(disconnectConnection, initial);
  return (
    <form
      action={action}
      className="mt-4 space-y-3 rounded-lg border border-outline-variant/20 bg-surface-container-lowest/70 p-4"
    >
      <input type="hidden" name="connectionId" value={connectionId} />
      <p className="text-sm font-medium text-on-background">Disconnect</p>
      <p className="text-xs leading-relaxed text-secondary">
        Authorization will be revoked when supported, credentials deleted, and
        scheduled sync stopped. Choose whether imported posts remain in My
        Content.
      </p>
      <label className="flex items-start gap-2 text-sm text-on-background">
        <input type="checkbox" name="deleteImportedData" className="mt-1" />
        Also remove imported content from this account (destructive)
      </label>
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "Disconnecting…" : "Disconnect"}
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function SyncSettingsForm({
  connectionId,
  defaults,
}: {
  connectionId: string;
  defaults: {
    autoSyncEnabled: boolean;
    syncFrequencyHours: number;
    importComments: boolean;
    importOlderPosts: boolean;
    useForAi: boolean;
    useForRoadmap: boolean;
    useForExperiments: boolean;
  };
}) {
  const [state, action, pending] = useActionState(
    updateConnectionSettings,
    initial,
  );
  return (
    <form action={action} className="mt-4 space-y-3 text-sm">
      <input type="hidden" name="connectionId" value={connectionId} />
      <p className="font-medium text-on-background">Sync settings</p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="autoSyncEnabled"
          defaultChecked={defaults.autoSyncEnabled}
        />
        Automatic sync enabled
      </label>
      <label className="flex items-center gap-2">
        Sync frequency (hours)
        <input
          type="number"
          name="syncFrequencyHours"
          min={1}
          max={168}
          defaultValue={defaults.syncFrequencyHours}
          className="ml-2 w-20 rounded border border-outline-variant/30 bg-surface-container-lowest px-2 py-1"
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="importComments"
          defaultChecked={defaults.importComments}
        />
        Import comments when available
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="importOlderPosts"
          defaultChecked={defaults.importOlderPosts}
        />
        Import older posts (more API pages)
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="useForAi"
          defaultChecked={defaults.useForAi}
        />
        Use data for AI recommendations
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="useForRoadmap"
          defaultChecked={defaults.useForRoadmap}
        />
        Use data for roadmap
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="useForExperiments"
          defaultChecked={defaults.useForExperiments}
        />
        Use data for experiments
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}
