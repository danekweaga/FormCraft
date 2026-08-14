import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="#171717" />
      <path
        fill="#FAFAF8"
        d="M8.4 7.2h15.2v3.6H12.6v3.35h8.7v3.35H12.6V24.8H8.4V7.2z"
      />
      <rect
        x="21.9"
        y="19.6"
        width="2.35"
        height="5.2"
        rx="0.55"
        fill="#FAFAF8"
        opacity="0.45"
      />
      <rect
        x="25.35"
        y="16.4"
        width="2.35"
        height="8.4"
        rx="0.55"
        fill="#FAFAF8"
        opacity="0.85"
      />
    </svg>
  );
}
