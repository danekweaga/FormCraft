"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  applySavedTranscriptToPostAction,
  classifyPerformanceTopicsAction,
  type TopicClassificationState,
} from "./actions";

const initial: TopicClassificationState = {};

export function TopicClassificationButton() {
  const [state, action, pending] = useActionState(
    classifyPerformanceTopicsAction,
    initial,
  );
  return (
    <div className="space-y-2">
      <form action={action}>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Classifying stored text…" : "Classify missing topics — free"}
        </Button>
      </form>
      {state.error ? <p className="text-xs text-error">{state.error}</p> : null}
      {state.success ? (
        <p className="max-w-xl text-xs text-primary-container">{state.success}</p>
      ) : null}
    </div>
  );
}

export function SavedTranscriptMatcher({
  posts,
  reviews,
}: {
  posts: Array<{ id: string; label: string }>;
  reviews: Array<{ id: string; label: string }>;
}) {
  const [state, action, pending] = useActionState(
    applySavedTranscriptToPostAction,
    initial,
  );
  if (posts.length === 0 || reviews.length === 0) return null;

  return (
    <div className="mt-4 border-t border-outline-variant/20 pt-4">
      <p className="text-sm font-semibold text-on-background">
        Use a transcript you pasted before publishing
      </p>
      <p className="mt-1 text-xs text-secondary">
        Match the newly synced post to its saved Pre-Publish draft. The transcript
        is reused locally—nothing is transcribed again.
      </p>
      <form action={action} className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="sr-only" htmlFor="topic-post">
          Published post
        </label>
        <select
          id="topic-post"
          name="postId"
          defaultValue={posts[0]?.id}
          className="h-9 min-w-0 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-xs"
        >
          {posts.map((post) => (
            <option key={post.id} value={post.id}>
              Post: {post.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="topic-review">
          Saved Pre-Publish transcript
        </label>
        <select
          id="topic-review"
          name="reviewId"
          defaultValue={reviews[0]?.id}
          className="h-9 min-w-0 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-xs"
        >
          {reviews.map((review) => (
            <option key={review.id} value={review.id}>
              Draft: {review.label}
            </option>
          ))}
        </select>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Attaching saved transcript…" : "Use saved transcript"}
          </Button>
        </div>
      </form>
      {state.error ? <p className="mt-2 text-xs text-error">{state.error}</p> : null}
      {state.success ? (
        <p className="mt-2 text-xs text-primary-container">{state.success}</p>
      ) : null}
    </div>
  );
}
