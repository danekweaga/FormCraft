"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { Label } from "@/components/ui/label";
import {
  attachExperimentPost,
  detachExperimentPost,
  type ExperimentActionState,
} from "./actions";

const initial: ExperimentActionState = {};

function DetachPostForm({
  experimentId,
  postId,
  label,
}: {
  experimentId: string;
  postId: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(detachExperimentPost, initial);

  return (
    <li className="space-y-1 rounded-lg border border-outline-variant/20 px-2.5 py-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 text-xs text-secondary">{label}</span>
        <form action={action}>
          <input type="hidden" name="experimentId" value={experimentId} />
          <input type="hidden" name="postId" value={postId} />
          <ConfirmDeleteButton
            label={pending ? "Detaching…" : "Detach"}
            confirmMessage="Detach this post from the experiment?"
            variant="ghost"
            className="h-7 px-2 text-error"
          />
        </form>
      </div>
      {state.error ? (
        <p className="text-xs text-error">{state.error}</p>
      ) : null}
    </li>
  );
}

export function AttachPostForm({
  experimentId,
  posts,
  attachedPosts = [],
}: {
  experimentId: string;
  posts: Array<{ id: string; label: string }>;
  attachedPosts?: Array<{ id: string; label: string }>;
}) {
  const [state, action, pending] = useActionState(attachExperimentPost, initial);
  const attachable = posts.filter(
    (post) => !attachedPosts.some((attached) => attached.id === post.id),
  );

  return (
    <div className="mt-3 space-y-3 border-t border-outline-variant/15 pt-3">
      {attachedPosts.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-on-background">Attached posts</p>
          <ul className="space-y-1.5">
            {attachedPosts.map((post) => (
              <DetachPostForm
                key={post.id}
                experimentId={experimentId}
                postId={post.id}
                label={post.label}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {attachable.length === 0 ? (
        <p className="text-xs text-secondary">
          {posts.length === 0
            ? "No posts available to attach yet. Sync a connection or add a manual post first."
            : "All available posts are already attached."}
        </p>
      ) : (
        <form action={action} className="space-y-2">
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
            {attachable.map((post) => (
              <option key={post.id} value={post.id}>
                {post.label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "Attaching…" : "Attach post"}
          </Button>
          {state.error ? (
            <p className="text-xs text-error">{state.error}</p>
          ) : null}
          {state.message ? (
            <p className="text-xs text-secondary">{state.message}</p>
          ) : null}
        </form>
      )}
    </div>
  );
}
