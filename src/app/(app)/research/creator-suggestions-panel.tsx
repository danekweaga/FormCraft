"use client";

import Link from "next/link";
import { useActionState } from "react";
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
  configuredPlatforms,
}: {
  suggestions: CreatorSuggestionCard[];
  watchlists: Array<{ id: string; name: string }>;
  configuredPlatforms: string[];
}) {
  const [state, action, pending] = useActionState(
    findSimilarCreatorsAction,
    initial,
  );

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
            FormCraft searches the last 30 days using topics from your tracked
            creators, then ranks new accounts by shared subjects, recent posts,
            and real outlier evidence. Dismissed accounts stay dismissed.
          </p>
        </div>
        <form action={action} className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="similar-watchlist">
            Watchlist
          </label>
          <select
            id="similar-watchlist"
            name="watchlistId"
            defaultValue={watchlists[0]?.id}
            className="h-9 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
          >
            {watchlists.map((watchlist) => (
              <option key={watchlist.id} value={watchlist.id}>
                {watchlist.name}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            size="sm"
            disabled={pending || configuredPlatforms.length === 0}
          >
            {pending ? "Searching providers…" : "Find similar creators"}
          </Button>
        </form>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {configuredPlatforms.map((platform) => (
          <Badge key={platform} variant="default">
            {platform}
          </Badge>
        ))}
        {configuredPlatforms.length === 0 ? (
          <p className="text-xs text-error">
            Configure ScrapeCreators and/or YouTube before searching.
          </p>
        ) : null}
      </div>
      {state.error ? <p className="mt-3 text-sm text-error">{state.error}</p> : null}
      {state.success ? (
        <p className="mt-3 text-sm text-primary-container">{state.success}</p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {suggestions.map((suggestion) => (
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
          No similar-account recommendations yet. Add creators and pull their
          posts, then click <strong>Find similar creators</strong>.
        </div>
      )}
    </section>
  );
}

