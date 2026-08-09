import type { SyncProgressStep } from "@/lib/social/types";

export function SyncProgressList({ steps }: { steps: SyncProgressStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="mt-4 space-y-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest/60 p-4 text-sm">
      {steps.map((step) => {
        const mark =
          step.state === "done"
            ? "✓"
            : step.state === "active"
              ? "→"
              : step.state === "error"
                ? "!"
                : "○";
        return (
          <li
            key={step.id}
            className={
              step.state === "done"
                ? "text-on-background"
                : step.state === "active"
                  ? "font-medium text-primary"
                  : step.state === "error"
                    ? "text-destructive"
                    : "text-secondary"
            }
          >
            <span className="mr-2 inline-block w-4">{mark}</span>
            {step.label}
            {step.detail ? (
              <span className="text-secondary"> — {step.detail}</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
