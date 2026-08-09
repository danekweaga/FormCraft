import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-4 rounded-xl border border-dashed border-outline-variant/40 bg-surface-primary/40 p-8",
        className,
      )}
    >
      <div>
        <h3 className="font-headline text-xl font-semibold text-on-background">
          {title}
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-secondary">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
