import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-surface-variant text-on-surface-variant",
        primary: "bg-primary-container/10 text-primary",
        success: "bg-primary/10 text-primary",
        warning: "bg-surface-alt text-tertiary",
        danger: "bg-error/10 text-error",
        demo: "bg-surface-primary text-on-surface border border-outline/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
