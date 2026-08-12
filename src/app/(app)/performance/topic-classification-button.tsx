"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
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
