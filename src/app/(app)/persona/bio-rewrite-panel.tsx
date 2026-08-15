"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  rewriteBioFromPostsAction,
  type BioRewriteActionState,
} from "./actions";

export function BioRewritePanel({
  postCount,
  onApply,
}: {
  postCount: number;
  onApply: (bio: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<BioRewriteActionState>({});
  const [mustInclude, setMustInclude] = useState("");

  const canRewrite = postCount >= 3;

  return (
    <section
      className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4"
      aria-labelledby="bio-rewrite-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="bio-rewrite-title"
            className="font-headline text-base font-semibold text-on-background"
          >
            Rewrite bio from your posts
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-secondary">
            Draft Instagram-length bios from themes in your recent owned videos.
            Add anything that must stay in the bio, then rewrite. FormCraft never
            publishes to Instagram for you — apply a draft, then save the
            profile.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={pending || !canRewrite}
          onClick={() =>
            startTransition(async () => {
              setState({});
              const next = await rewriteBioFromPostsAction(mustInclude);
              setState(next);
            })
          }
        >
          {pending ? "Rewriting…" : "Rewrite from my posts"}
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="bio_must_include">What to keep in the bio</Label>
          <span className="text-xs text-secondary">
            {mustInclude.length}/500
          </span>
        </div>
        <Textarea
          id="bio_must_include"
          name="bio_must_include"
          rows={4}
          value={mustInclude}
          onChange={(event) => setMustInclude(event.currentTarget.value)}
          maxLength={500}
          placeholder={
            "Examples:\n• CS student @ Waterloo\n• Building in public\n• Link in bio for free Notion template\n• Soft CTA: DM “portfolio”"
          }
        />
        <p className="text-xs leading-relaxed text-secondary">
          Names, fixed lines, CTAs, or facts the rewrite should not drop. Separate
          with new lines or commas. These take priority over post themes when
          space is tight.
        </p>
      </div>

      {!canRewrite ? (
        <p className="mt-3 text-sm text-secondary">
          Sync or add at least 3 owned posts with titles or captions first.
        </p>
      ) : null}

      {state.error ? (
        <p className="mt-3 text-sm text-error">{state.error}</p>
      ) : null}

      {state.result ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={state.usedLlm ? "success" : "default"}>
              {state.usedLlm ? "AI draft" : "Heuristic draft"}
            </Badge>
            {state.result.observedThemes.length > 0 ? (
              <p className="text-xs text-secondary">
                Themes: {state.result.observedThemes.slice(0, 5).join(" · ")}
              </p>
            ) : null}
          </div>
          <ul className="space-y-3">
            {state.result.variants.map((variant, index) => (
              <li
                key={`${variant.bio}-${index}`}
                className="rounded-lg border border-outline-variant/15 bg-surface-primary p-3"
              >
                <p className="whitespace-pre-line text-sm font-medium text-on-background">
                  {variant.bio}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-secondary">
                  {variant.rationale}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-secondary">
                    {variant.bio.length}/150
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onApply(variant.bio.slice(0, 150))}
                  >
                    Use this bio
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
