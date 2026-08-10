"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { MaterialIcon } from "./material-icon";
import { GlobalCommandPalette } from "./global-command-palette";
import { cn } from "@/lib/utils";

const CONTENT_TABS = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/research", label: "Discover", icon: "explore" },
  { href: "/create", label: "Build", icon: "edit_note" },
] as const;

export function AppTopBar({
  email,
  displayName,
}: {
  email?: string | null;
  displayName?: string | null;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant/15 bg-surface/95 px-4 backdrop-blur md:px-8">
      <div className="flex flex-1 items-center gap-3">
        <MobileNav />
        <nav
          aria-label="Content navigation"
          className="flex shrink-0 items-center gap-2"
        >
          {CONTENT_TABS.map((tab) => {
            const active =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-lg border px-2 text-sm font-semibold transition-colors sm:px-3",
                  active
                    ? "border-primary-container bg-primary-container text-white"
                    : "border-outline-variant/20 bg-surface text-on-surface hover:bg-surface-container-low",
                )}
              >
                <MaterialIcon name={tab.icon} filled={active} className="text-lg" />
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
        <GlobalCommandPalette />
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-secondary hover:bg-surface-container-low"
          aria-label="Ask Intelligence"
          disabled
        >
          <MaterialIcon name="smart_toy" />
        </button>
        <Link
          href="/usage#notifications"
          className="flex h-10 w-10 items-center justify-center rounded-full text-secondary hover:bg-surface-container-low"
          aria-label="Notifications"
        >
          <MaterialIcon name="notifications" />
        </Link>
        <UserMenu email={email} displayName={displayName} />
      </div>
    </header>
  );
}
