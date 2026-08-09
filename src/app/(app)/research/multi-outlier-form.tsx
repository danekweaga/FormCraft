"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  synthesizeMultiOutliersAction,
  type ResearchActionState,
} from "./actions";
import type { ResearchCardItem } from "./research-item-card";

const initial: ResearchActionState = {};

export function MultiOutlierForm({ items }: { items: ResearchCardItem[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [state, action, pending] = useActionState(
    synthesizeMultiOutliersAction,
    initial,
  );

  if (items.length < 2) return null;

  return (
    <form action={action} className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4 paper-shadow">
      <p className="text-sm font-semibold text-on-background">
        Find the common opportunity
      </p>
      <p className="mt-1 text-xs text-secondary">
        Select 2–7 posts. Synthesis uses stored metadata + your FormCraft context.
      </p>
      <ul className="mt-3 max-h-48 space-y-2 overflow-auto text-sm">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={(e) => {
                setSelected((prev) =>
                  e.target.checked
                    ? [...prev, item.id].slice(0, 7)
                    : prev.filter((id) => id !== item.id),
                );
              }}
            />
            <span className="text-secondary">
              {(item.title || "Untitled").slice(0, 90)}
              {item.outlier_score != null
                ? ` · ${Number(item.outlier_score).toFixed(1)}×`
                : ""}
            </span>
          </li>
        ))}
      </ul>
      {selected.map((id) => (
        <input key={id} type="hidden" name="itemIds" value={id} />
      ))}
      <Button
        type="submit"
        className="mt-3"
        size="sm"
        disabled={pending || selected.length < 2}
      >
        {pending ? "Synthesizing…" : "Find common opportunity"}
      </Button>
      {state.error ? (
        <p className="mt-2 text-sm text-error">{state.error}</p>
      ) : null}
      {state.success ? (
        <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-container-lowest p-3 text-xs text-secondary">
          {state.success}
        </pre>
      ) : null}
    </form>
  );
}
