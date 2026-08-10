"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  runResearchScanAction,
  saveResearchReferenceAction,
  type ResearchActionState,
} from "./actions";

const initialState: ResearchActionState = {};

function ResultMessage({ state }: { state: ResearchActionState }) {
  if (state.error) return <p className="text-sm text-error">{state.error}</p>;
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

  const hasNonYoutube = platforms.some((p) => p.platform !== "youtube");
  const youtubeOnly =
    platforms.length > 0 && platforms.every((p) => p.platform === "youtube");
  const youtubeDefaultOn = youtubeOnly && !hasNonYoutube;

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
          Select a live discovery source. TikTok Login only syncs your own
          account; public TikTok niche search needs TIKTOK_DATA_API_KEY.
          Instagram public search is not available via its official API, so use
          Manual reference for Instagram links.
        </p>
        <div className="flex flex-wrap gap-4">
          {platforms.map((p) => {
            const isYoutube = p.platform === "youtube";
            const defaultChecked = isYoutube
              ? youtubeDefaultOn
              : true;
            return (
              <label
                key={p.platform}
                className="flex items-center gap-2 text-sm text-on-background"
              >
                <input
                  type="checkbox"
                  name="platforms"
                  value={p.platform}
                  defaultChecked={defaultChecked}
                  className="size-4 rounded border-outline-variant"
                />
                <span>
                  {isYoutube
                    ? "YouTube (live public search)"
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
            niche search — fewer irrelevant results, lower API spend.
          </p>
          {creators.length > 0 ? (
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
                    className="size-3.5"
                  />
                  {c.label} · {c.platform}
                </label>
              ))}
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
            <option value="365">1 year</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="min-views">Minimum views</Label>
          <Input id="min-views" name="minViews" type="number" min="0" defaultValue="1000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="outlier-score">Minimum outlier</Label>
          <Input
            id="outlier-score"
            name="minOutlierScore"
            type="number"
            min="0"
            step="0.1"
            defaultValue="1.5"
          />
        </div>
      </div>
      <Button type="submit" disabled={pending || !configured}>
        {pending ? "Searching public videos…" : "Search public videos"}
      </Button>
      {!configured ? (
        <p className="text-sm text-secondary">
          Add TIKTOK_DATA_API_KEY and/or YOUTUBE_DATA_API_KEY, or set
          RESEARCH_ENABLE_DEMO=1 for fixture results (labelled demo, not live
          platform data).
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
          placeholder="Paste the actual spoken transcript here. FormCraft will try public YouTube captions, but paste/upload the transcript if YouTube does not expose them."
          className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Analyze and save reference"}
      </Button>
      <p className="text-xs text-secondary">
        Instagram has no official niche search — paste a public post/Reel URL
        here.
      </p>
      <ResultMessage state={state} />
    </form>
  );
}
