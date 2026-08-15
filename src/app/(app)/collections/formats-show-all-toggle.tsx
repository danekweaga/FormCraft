import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FormatsShowAllToggle({
  showAll,
  query,
  hiddenEmpty,
}: {
  showAll: boolean;
  query: string;
  hiddenEmpty: number;
}) {
  const href = showAll
    ? `/collections${query ? `?q=${encodeURIComponent(query)}` : ""}`
    : `/collections?all=1${query ? `&q=${encodeURIComponent(query)}` : ""}`;

  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href}>
        {showAll
          ? "Hide empty formats"
          : `Show all formats${hiddenEmpty > 0 ? ` (${hiddenEmpty} empty)` : ""}`}
      </Link>
    </Button>
  );
}
