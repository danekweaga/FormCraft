"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addCreatorToWatchlistAction,
  createWatchlistAction,
  refreshWatchlistMonitoringAction,
  type ResearchActionState,
} from "./actions";

const initial: ResearchActionState = {};

export function WatchlistRefreshForm() {
  const [state, action, pending] = useActionState(
    refreshWatchlistMonitoringAction,
    initial,
  );
  return (
    <form action={action} className="mt-3 space-y-2">
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Checking channels…" : "Refresh now"}
      </Button>
      {state.error ? <p className="text-sm text-error">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-primary-container">{state.success}</p>
      ) : null}
    </form>
  );
}

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

/**
 * Sandcastle-style: add niche creators by handle, then pull their outliers.
 */
export function AddCreatorToWatchlistForm({
  watchlists,
  tiktokConfigured,
  youtubeConfigured,
}: {
  watchlists: Array<{ id: string; name: string }>;
  tiktokConfigured: boolean;
  youtubeConfigured: boolean;
}) {
  const [state, action, pending] = useActionState(
    addCreatorToWatchlistAction,
    initial,
  );

  if (watchlists.length === 0) {
    return (
      <p className="text-sm text-secondary">
        Create a watchlist first, then add creators by @handle.
      </p>
    );
  }

  const defaultPlatform = tiktokConfigured
    ? "tiktok"
    : youtubeConfigured
      ? "youtube"
      : "tiktok";

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-secondary">
        Same model as Sandcastle: list creators in your niche → pull their
        recent posts → score outliers vs that creator&apos;s baseline. No
        Instagram auto-pull (paste URLs in Discover instead).
      </p>
      <div className="space-y-2">
        <Label htmlFor="wl-pick">Watchlist</Label>
        <select
          id="wl-pick"
          name="watchlistId"
          required
          className="h-10 w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
          defaultValue={watchlists[0]?.id}
        >
          {watchlists.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="wl-platform">Platform</Label>
          <select
            id="wl-platform"
            name="platform"
            defaultValue={defaultPlatform}
            className="h-10 w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
          >
            <option value="tiktok" disabled={!tiktokConfigured}>
              TikTok{tiktokConfigured ? "" : " (needs TIKTOK_DATA_API_KEY)"}
            </option>
            <option value="youtube" disabled={!youtubeConfigured}>
              YouTube{youtubeConfigured ? "" : " (needs YOUTUBE_DATA_API_KEY)"}
            </option>
            <option value="instagram">Instagram (manual only)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wl-handle">Handle</Label>
          <Input
            id="wl-handle"
            name="handle"
            placeholder="@creator or UC… channel id"
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={pending || (!tiktokConfigured && !youtubeConfigured)}>
        {pending ? "Adding & pulling…" : "Add creator & pull posts"}
      </Button>
      {!tiktokConfigured && !youtubeConfigured ? (
        <p className="text-xs text-secondary">
          Set TIKTOK_DATA_API_KEY (recommended) or YOUTUBE_DATA_API_KEY to pull
          posts.
        </p>
      ) : null}
      {state.error ? <p className="text-sm text-error">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-primary-container">{state.success}</p>
      ) : null}
    </form>
  );
}
