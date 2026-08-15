"use client";

import { Button } from "@/components/ui/button";

/** Submit button that asks for confirmation before the parent form posts. */
export function ConfirmDeleteButton({
  label = "Delete",
  confirmMessage = "Delete this permanently? This cannot be undone.",
  size = "sm",
  variant = "ghost",
  className,
}: {
  label?: string;
  confirmMessage?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "ghost" | "outline" | "destructive" | "default";
  className?: string;
}) {
  return (
    <Button
      type="submit"
      size={size}
      variant={variant}
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {label}
    </Button>
  );
}
