"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MaterialIcon } from "./material-icon";
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "./nav-config";

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active =
    pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold tracking-wide transition-colors active:scale-95",
        active
          ? "bg-surface-container-low text-primary"
          : "text-secondary hover:bg-surface-container-low",
      )}
    >
      <MaterialIcon name={item.icon} filled={active} />
      <span>{item.label}</span>
    </Link>
  );
}

export function PrimaryNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {PRIMARY_NAV.map((item) => (
        <NavLink key={item.href} item={item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

export function SecondaryNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="mt-4 flex flex-col gap-1 border-t border-outline-variant/15 pt-4">
      {SECONDARY_NAV.map((item) => (
        <NavLink key={item.href} item={item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
