"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  acceptCreatorSuggestionAction,
  dismissCreatorSuggestionAction,
  findSimilarCreatorsAction,
  type ResearchActionState,
} from "./actions";

const initial: ResearchActionState = {};

export type CreatorSuggestionCard = {
  id: string;
  watchlistId: string;
  watchlistName: string;
  externalCreatorId: string;
  platform: string;
  handle: string | null;
  displayName: string | null;
  followerCount: number | null;
  score: number;
  reasons: string[];
  matchedTopics: string[];
  evidence: {
    recentPostCount?: number;
    outlierPostCount?: number;
    strongestOutlierScore?: number | null;
  } | null;
};

function SuggestionActions({ suggestionId }: { suggestionId: string }) {
  const [acceptState, acceptAction, accepting] = useActionState(
    acceptCreatorSuggestionAction,
    initial,
  );
  const [dismissState, dismissAction, dismissing] = useActionState(
    dismissCreatorSuggestionAction,
    initial,
  );
  const state = acceptState.error || acceptState.success ? acceptState : dismissState;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <form action={acceptAction}>
          <input type="hidden" name="suggestionId" value={suggestionId} />
          <Button type="submit" size="sm" disabled={accepting || dismissing}>
            {accepting ? "Adding & pulling…" : "Add to watchlist"}
          </Button>
        </form>
        <form action={dismissAction}>
          <input type="hidden" name="suggestionId" value={suggestionId} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            disabled={accepting || dismissing}
          >
            {dismissing ? "Dismissing…" : "Not a fit"}
          </Button>
        </form>
      </div>
      {state.error ? <p className="text-xs text-error">{state.error}</p> : null}
      {state.success ? (
        <p className="text-xs text-primary-container">{state.success}</p>
      ) : null}
    </div>
  );
}

export function CreatorSuggestionsPanel({
  suggestions,
  watchlists,
  availablePlatforms,
}: {
  suggestions: CreatorSuggestionCard[];
  watchlists: Array<{ id: string; name: string }>;
  availablePlatforms: string[];
}) {
  const [state, action, pending] = useActionState(
    findSimilarCreatorsAction,
    initial,
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState(availablePlatforms);
  const activePlatforms = new Set(selectedPlatforms);
  const visibleSuggestions = suggestions.filter((suggestion) =>
    activePlatforms.has(suggestion.platform),
  );
  const togglePlatform = (platform: string, checked: boolean) => {
    setSelectedPlatforms((current) =>
      checked
        ? Array.from(new Set([...current, platform]))
        : current.filter((entry) => entry !== platform),
    );
  };

  if (watchlists.length === 0) return null;

  return (
    <section className="rounded-xl border border-primary-container/20 bg-surface-primary p-4 paper-shadow">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-headline text-lg font-semibold text-on-background">
              Similar accounts to grow your library
            </h3>
            <Badge variant="primary">Learns from watchlists</Badge>
          </div>
          <p className="mt-1 text-sm text-secondary">
            FormCraft ranks accounts already found in your 30-day library by
            shared subjects, recent posts, and real outlier evidence. Choose the
            platforms you want. Live provider search is optional and uses quota.
          </p>
        </div>
        <form action={action} className="w-full space-y-3 lg:max-w-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs font-medium text-secondary">
              Watchlist
              <select
                id="similar-watchlist"
                name="watchlistId"
                defaultValue={watchlists[0]?.id}
                className="mt-1 h-9 w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm text-on-background"
              >
                {watchlists.map((watchlist) => (
                  <option key={watchlist.id} value={watchlist.id}>
                    {watchlist.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="submit"
              size="sm"
              disabled={pending || selectedPlatforms.length === 0}
            >
              {pending ? "Ranking creators…" : "Find similar creators"}
            </Button>
          </div>
          <fieldset>
            <legend className="text-xs font-medium text-secondary">
              Suggest accounts from
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {availablePlatforms.map((platform) => (
                <label
                  key={platform}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-on-background"
                >
                  <input
                    type="checkbox"
                    name="platforms"
                    value={platform}
                    checked={selectedPlatforms.includes(platform)}
                    onChange={(event) =>
                      togglePlatform(platform, event.currentTarget.checked)
                    }
                    className="size-3.5 accent-primary"
                  />
                  <span className="capitalize">{platform}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-xs text-secondary">
            <input
              type="checkbox"
              name="refreshProviders"
              value="1"
              className="mt-0.5 size-3.5 accent-primary"
            />
            <span>
              Refresh live providers first. This can discover additional
              accounts, but it uses daily provider quota.
            </span>
          </label>
        </form>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {availablePlatforms.length === 0 ? (
          <p className="text-xs text-error">
            Add creators and pull their posts before asking for similar accounts.
          </p>
        ) : null}
        {availablePlatforms.length > 0 && visibleSuggestions.length === 0 ? (
          <p className="text-xs text-secondary">
            No saved suggestions match {selectedPlatforms.join(" + ") || "the selected platforms"} yet.
            Refresh those watchlist creators or use the optional live-provider search.
          </p>
        ) : null}
      </div>
      {state.error ? <p className="mt-3 text-sm text-error">{state.error}</p> : null}
      {state.success ? (
        <p className="mt-3 text-sm text-primary-container">{state.success}</p>
      ) : null}

      {visibleSuggestions.length > 0 ? (
        <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleSuggestions.map((suggestion) => (
            <li
              key={suggestion.id}
              className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-on-background">
                    {suggestion.displayName ||
                      (suggestion.handle ? `@${suggestion.handle}` : "Creator")}
                  </p>
                  <p className="truncate text-xs text-secondary">
                    {suggestion.handle ? `@${suggestion.handle} · ` : ""}
                    {suggestion.platform} · suggested for {suggestion.watchlistName}
                  </p>
                </div>
                <Badge variant={suggestion.score >= 70 ? "success" : "primary"}>
                  {suggestion.score}% fit
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {suggestion.matchedTopics.slice(0, 5).map((topic) => (
                  <Badge key={topic} variant="default">
                    {topic}
                  </Badge>
                ))}
              </div>
              <ul className="mt-3 space-y-1 text-xs text-secondary">
                {suggestion.reasons.slice(0, 3).map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-secondary">
                {suggestion.followerCount != null ? (
                  <span>{suggestion.followerCount.toLocaleString()} followers</span>
                ) : null}
                {suggestion.evidence?.recentPostCount != null ? (
                  <span>· {suggestion.evidence.recentPostCount} sampled posts</span>
                ) : null}
                <Link
                  href={`/research/creators/${suggestion.externalCreatorId}`}
                  className="ml-auto font-medium text-primary hover:underline"
                >
                  Inspect evidence
                </Link>
              </div>
              <SuggestionActions suggestionId={suggestion.id} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-outline-variant/30 p-5 text-sm text-secondary">
          No recommendations match the selected platforms yet. Pull more
          watchlist posts or enable the optional live-provider refresh.
        </div>
      )}
    </section>
  );
}
