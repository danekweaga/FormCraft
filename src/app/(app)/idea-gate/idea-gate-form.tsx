"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  evaluateIdea,
  evaluateIdeaFromVideoLink,
  type IdeaGateActionState,
} from "./actions";

const initial: IdeaGateActionState = {};

export function IdeaGateForm() {
  const [mode, setMode] = useState<"text" | "link">("link");
  const [textState, textAction, textPending] = useActionState(
    evaluateIdea,
    initial,
  );
  const [linkState, linkAction, linkPending] = useActionState(
    evaluateIdeaFromVideoLink,
    initial,
  );

  const state = mode === "link" ? linkState : textState;
  const pending = mode === "link" ? linkPending : textPending;

  return (
    <div className="space-y-4 rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow">
      <div>
        <h2 className="font-headline text-xl font-semibold text-on-background">
          Gate an idea
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Paste a video link to invent an original take, or type an idea
          directly. FormCraft checks audience fit, brand, originality, proof,
          format, hooks, effort, and claim risk before you draft.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "link" ? "default" : "outline"}
          onClick={() => setMode("link")}
        >
          From video link
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "text" ? "default" : "outline"}
          onClick={() => setMode("text")}
        >
          Type an idea
        </Button>
      </div>

      {mode === "link" ? (
        <form action={linkAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="videoUrl">Video link</Label>
            <Input
              id="videoUrl"
              name="videoUrl"
              type="url"
              required
              placeholder="https://www.instagram.com/reel/… or TikTok / YouTube"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Your angle (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="What you want to change, prove, or say differently."
            />
          </div>
          {state.error ? (
            <p className="text-sm text-red-700" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-primary-container" role="status">
              {state.successMessage ?? "Idea gated from the video link."}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Building idea from link…" : "Turn link into idea"}
          </Button>
        </form>
      ) : (
        <form action={textAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ideaText">Idea</Label>
            <Textarea
              id="ideaText"
              name="ideaText"
              required
              rows={6}
              placeholder="For CS students who freeze on applications: how to ship one portfolio project that gets replies."
            />
          </div>
          {state.error ? (
            <p className="text-sm text-red-700" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-primary-container" role="status">
              Idea evaluated.
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Evaluating…" : "Evaluate idea"}
          </Button>
        </form>
      )}
    </div>
  );
}
