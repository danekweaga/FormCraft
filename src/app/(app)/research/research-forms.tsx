"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_RESEARCH_VIEWS } from "@/lib/research/visibility-policy";
import {
  runResearchScanAction,
  saveResearchReferenceAction,
  type ResearchActionState,
} from "./actions";

const initialState: ResearchActionState = {};

function ResultMessage({ state }: { state: ResearchActionState }) {
  if (state.error) return <p className="text-sm text-error">{state.error}</p>;
  if (
    state.discovered != null ||
    state.eligible != null ||
    state.retained != null
  ) {
    return (
      <div className="space-y-1 text-sm text-primary-container">
        <p className="font-medium">
          Discovered {state.discovered ?? "—"} · eligible {state.eligible ?? "—"}{" "}
          · retained {state.retained ?? "—"}
        </p>
        {state.providers?.length ? (
          <p className="text-xs text-secondary">
            Providers: {state.providers.join(", ")}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-xs text-secondary">{state.success}</p>
        ) : null}
        {state.notes?.length ? (
          <ul className="space-y-1 text-xs text-secondary">
            {state.notes.slice(0, 4).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  if (state.success) {
    return <p className="text-sm text-primary-container">{state.success}</p>;
  }
  return null;
}

export type ScanPlatformOption = {
  platform: string;
  providerName: string;
  providerType: string;
};

export type ScanCreatorOption = {
  id: string;
  label: string;
  platform: string;
};

export function ResearchScanForm({
  configured,
  platforms,
  creators = [],
  initialQuery = "",
}: {
  configured: boolean;
  platforms: ScanPlatformOption[];
  creators?: ScanCreatorOption[];
  initialQuery?: string;
}) {
  const [state, action, pending] = useActionState(
    runResearchScanAction,
    initialState,
  );
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<Set<string>>(
    () => new Set(),
  );

  const hasYoutube = platforms.some((p) => p.platform === "youtube");
  const allCreatorsSelected =
    creators.length > 0 && selectedCreatorIds.size === creators.length;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="research-query">Niche or topic</Label>
        <Input
          id="research-query"
          key={initialQuery}
          name="query"
          placeholder="e.g. beginner web development career"
          defaultValue={initialQuery}
          required
          minLength={2}
          maxLength={160}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-on-background">
          Platforms
        </legend>
        <p className="text-xs text-secondary">
          Pulls live YouTube Shorts, TikTok, and Instagram Reels when those
          sources are configured.
          {hasYoutube
            ? " Leave YouTube checked to include Shorts (official API, no ScrapeCreators credits)."
            : ""}
        </p>
        <input type="hidden" name="maxResults" value="50" />
        <div className="flex flex-wrap gap-4">
          {platforms.map((p) => {
            const isYoutube = p.platform === "youtube";
            return (
              <label
                key={p.platform}
                className="flex items-center gap-2 text-sm text-on-background"
              >
                <input
                  type="checkbox"
                  name="platforms"
                  value={p.platform}
                  defaultChecked
                  className="size-4 rounded border-outline-variant"
                />
                <span>
                  {isYoutube
                    ? "YouTube Shorts (official search)"
                    : p.platform === "tiktok" && p.providerName === "scrapecreators"
                      ? "TikTok (ScrapeCreators)"
                      : p.platform === "instagram"
                        ? "Instagram Reels (ScrapeCreators)"
                        : p.platform === "tiktok"
                          ? "TikTok (TikTokAPI.store)"
                          : `${p.platform} (${p.providerName})`}
                </span>
              </label>
            );
          })}
          {platforms.length === 0 ? (
            <p className="text-sm text-secondary">No searchable platforms configured.</p>
          ) : null}
        </div>
      </fieldset>

      {(creators.length > 0 || configured) && (
        <div className="space-y-3 rounded-lg border border-outline-variant/20 p-3">
          <p className="text-sm font-medium text-on-background">
            Channel targeting (optional)
          </p>
          <p className="text-xs text-secondary">
            When you select tracked creators or paste handles, FormCraft pulls
            those channels&apos; posts via getCreatorPosts instead of a broad
            niche search. Select all queues every supported creator shown.
            FormCraft processes the stalest channels in safe batches, then the
            daily scanner continues the queue automatically. The outlier
            filters decide which videos stay.
          </p>
          {creators.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-secondary">
                  {selectedCreatorIds.size} of {creators.length} selected
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={allCreatorsSelected}
                    onClick={() =>
                      setSelectedCreatorIds(
                        new Set(creators.map((creator) => creator.id)),
                      )
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={selectedCreatorIds.size === 0}
                    onClick={() => setSelectedCreatorIds(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {creators.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 rounded-full border border-outline-variant/30 px-3 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      name="creatorIds"
                      value={c.id}
                      checked={selectedCreatorIds.has(c.id)}
                      onChange={(event) =>
                        setSelectedCreatorIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        })
                      }
                      className="size-3.5"
                    />
                    {c.label} · {c.platform}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="channel-handles">
              Or paste handles / channel IDs
            </Label>
            <textarea
              id="channel-handles"
              name="channelHandles"
              rows={2}
              placeholder={"@creator (TikTok)\nUCxxxx… or @handle (YouTube, only if Include YouTube is on)"}
              className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="lookback-days">Published within</Label>
          <select
            id="lookback-days"
            name="lookbackDays"
            defaultValue="30"
            className="h-10 w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
          >
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="min-views">Minimum views</Label>
          <Input
            id="min-views"
            name="minViews"
            type="number"
            min={MIN_RESEARCH_VIEWS}
            defaultValue={MIN_RESEARCH_VIEWS}
          />
          <p className="text-xs text-secondary">
            FormCraft never shows discovery videos below 20,000 verified views.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="outlier-score">Minimum outlier (optional)</Label>
          <Input
            id="outlier-score"
            name="minOutlierScore"
            type="number"
            min="0"
            step="0.1"
            defaultValue="0"
          />
          <p className="text-xs text-secondary">
            Leave at 0 for first pulls. Raise (e.g. 1.5) once you have baselines.
          </p>
        </div>
      </div>
      <Button type="submit" disabled={pending || !configured}>
        {pending ? "Pulling live videos…" : "Pull live videos"}
      </Button>
      {!configured ? (
        <p className="text-sm text-secondary">
          Add SCRAPECREATORS_API_KEY for TikTok + Instagram, and/or
          YOUTUBE_DATA_API_KEY for official YouTube search. RESEARCH_ENABLE_DEMO=1
          still works for fixture results (labelled demo, not live platform data).
        </p>
      ) : null}
      <ResultMessage state={state} />
    </form>
  );
}

export function SaveResearchReferenceForm() {
  const [state, action, pending] = useActionState(
    saveResearchReferenceAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reference-url">Video URL</Label>
        <Input
          id="reference-url"
          name="url"
          type="url"
          placeholder="https://… (Instagram, TikTok, YouTube, etc.)"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reference-title">Title or spoken hook</Label>
        <Input id="reference-title" name="title" maxLength={300} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reference-notes">Caption or notes</Label>
        <textarea
          id="reference-notes"
          name="notes"
          rows={4}
          maxLength={5000}
          className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reference-transcript">Transcript (for spoken-hook analysis)</Label>
        <textarea
          id="reference-transcript"
          name="transcript"
          rows={6}
          maxLength={40000}
          placeholder="Optional: paste the spoken transcript. If blank, FormCraft asks Supadata for supported public links and caches the result."
          className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Analyze and save reference"}
      </Button>
      <p className="text-xs text-secondary">
        Instagram Reels are searchable via ScrapeCreators. Paste a URL here when
        you already have a specific post to analyze.
      </p>
      <ResultMessage state={state} />
    </form>
  );
}
