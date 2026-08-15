"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  startIdeaFromLinkAction,
  type StartIdeaFromLinkState,
} from "./actions";

const initialState: StartIdeaFromLinkState = {};

export function PasteLinkIdeaForm() {
  const [state, action, pending] = useActionState(
    startIdeaFromLinkAction,
    initialState,
  );

  return (
    <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
      <CardHeader>
        <CardTitle>Paste a video link</CardTitle>
        <CardDescription>
          Drop an Instagram, TikTok, or YouTube URL. FormCraft saves it as a
          reference, then you add your spin on the original.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="build-link-url">Video URL</Label>
            <Input
              id="build-link-url"
              name="url"
              type="url"
              placeholder="https://… (Instagram, TikTok, YouTube)"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="build-link-title">Title or hook (optional)</Label>
            <Input id="build-link-title" name="title" maxLength={300} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="build-link-notes">Caption or notes (optional)</Label>
            <Textarea
              id="build-link-notes"
              name="notes"
              rows={3}
              maxLength={5000}
              placeholder="Anything useful about the original before you add your angle…"
            />
          </div>
          {state.error ? (
            <p className="text-sm text-error">{state.error}</p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Loading video…" : "Use this video"}
          </Button>
          <p className="text-xs text-secondary">
            Next step: write what’s your spin, then Develop my version.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
