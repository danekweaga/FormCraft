import { cn } from "@/lib/utils";

export function MaterialIcon({
  name,
  className,
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={cn(
        "material-symbols-outlined inline-flex h-[1.25em] w-[1.25em] shrink-0 items-center justify-center overflow-hidden text-[22px] leading-none select-none",
        className,
      )}
      style={{
        fontVariationSettings: filled
          ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
          : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}
