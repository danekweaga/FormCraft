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
        "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold tracking-wide transition-colors active:scale-[0.98]",
        active
          ? "bg-on-background text-white"
          : "text-secondary hover:bg-surface-container-low hover:text-on-background",
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
  const groups = ["Intelligence", "Workspace", "Configure"] as const;
  return (
    <nav className="mt-5 border-t border-outline-variant/15 pt-4">
      {groups.map((group) => (
        <div key={group} className="mb-5">
          <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary/80">
            {group}
          </p>
          <div className="flex flex-col gap-1">
            {SECONDARY_NAV.filter((item) => item.group === group).map((item) => (
              <NavLink key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
