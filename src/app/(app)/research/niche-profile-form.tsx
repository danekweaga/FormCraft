"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveNicheProfileAction, type ResearchActionState } from "./actions";

const initial: ResearchActionState = {};

export function NicheProfileForm({
  initial: values,
  searchablePlatforms,
}: {
  initial: {
    mainNiche: string;
    topics: string;
    keywords: string;
    targetAudience: string;
    platforms: string[];
  };
  searchablePlatforms: Array<{ platform: string; providerName: string }>;
}) {
  const [state, action, pending] = useActionState(
    saveNicheProfileAction,
    initial,
  );

  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="mainNiche">Main niche</Label>
        <Input
          id="mainNiche"
          name="mainNiche"
          defaultValue={values.mainNiche}
          placeholder="AI for CS students"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="targetAudience">Target audience</Label>
        <Input
          id="targetAudience"
          name="targetAudience"
          defaultValue={values.targetAudience}
          placeholder="CS students building careers"
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="topics">Topics (comma-separated)</Label>
        <Input
          id="topics"
          name="topics"
          defaultValue={values.topics}
          placeholder="internships, vibe coding, portfolios"
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="keywords">Keywords</Label>
        <Input
          id="keywords"
          name="keywords"
          defaultValue={values.keywords}
          placeholder="leetcode, openai, hackathon"
        />
      </div>

      <fieldset className="space-y-2 md:col-span-2">
        <legend className="text-sm font-medium text-on-background">
          Auto-scan platforms
        </legend>
        <p className="text-xs text-secondary">
          Saved to your niche profile and used by Auto: scans. YouTube is on by
          default when configured — uncheck to save quota.
        </p>
        <div className="flex flex-wrap gap-4">
          {searchablePlatforms.map((p) => {
            const isYoutube = p.platform === "youtube";
            const saved = values.platforms.includes(p.platform);
            const defaultChecked =
              saved || (!values.platforms.length && true);
            return (
              <label
                key={p.platform}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="platforms"
                  value={p.platform}
                  defaultChecked={defaultChecked}
                  className="size-4 rounded border-outline-variant"
                />
                {isYoutube
                  ? "YouTube Shorts search"
                  : `${p.platform} (${p.providerName})`}
              </label>
            );
          })}
          {searchablePlatforms.length === 0 ? (
            <p className="text-sm text-secondary">
              Configure TIKTOK_DATA_API_KEY or YOUTUBE_DATA_API_KEY first.
            </p>
          ) : null}
        </div>
      </fieldset>

      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save niche profile"}
        </Button>
        {state.error ? (
          <p className="mt-2 text-sm text-error">{state.error}</p>
        ) : null}
        {state.success ? (
          <p className="mt-2 text-sm text-primary-container">{state.success}</p>
        ) : null}
      </div>
    </form>
  );
}
