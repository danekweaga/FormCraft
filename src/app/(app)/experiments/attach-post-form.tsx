"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { attachExperimentPost, type ExperimentActionState } from "./actions";

const initial: ExperimentActionState = {};

export function AttachPostForm({
  experimentId,
  posts,
}: {
  experimentId: string;
  posts: Array<{ id: string; label: string }>;
}) {
  const [state, action, pending] = useActionState(attachExperimentPost, initial);

  if (posts.length === 0) {
    return (
      <p className="mt-3 text-xs text-secondary">
        No posts available to attach yet. Sync a connection or add a manual
        post first.
      </p>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-2 border-t border-outline-variant/15 pt-3">
      <input type="hidden" name="experimentId" value={experimentId} />
      <Label htmlFor={`post-${experimentId}`} className="text-xs">
        Attach a published post (confirm match yourself)
      </Label>
      <select
        id={`post-${experimentId}`}
        name="postId"
        required
        className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm"
        defaultValue=""
      >
        <option value="" disabled>
          Select post…
        </option>
        {posts.map((post) => (
          <option key={post.id} value={post.id}>
            {post.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Attaching…" : "Attach post"}
      </Button>
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="text-xs text-secondary">{state.message}</p>
      ) : null}
    </form>
  );
}
