"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { MaterialIcon } from "./material-icon";
import { cn } from "@/lib/utils";

const CONTENT_TABS = [
  { href: "/my-content", label: "My Content", icon: "movie" },
  { href: "/performance", label: "Performance", icon: "analytics" },
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
        <div className="relative hidden w-full max-w-xl sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
          <input
            type="search"
            placeholder="Search insights, drafts, or patterns..."
            className="w-full rounded-full border-none bg-surface-container-low py-2 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary-container"
            disabled
            aria-label="Search (coming soon)"
          />
        </div>
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
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-secondary hover:bg-surface-container-low"
          aria-label="Notifications"
          disabled
        >
          <MaterialIcon name="notifications" />
        </button>
        <UserMenu email={email} displayName={displayName} />
      </div>
    </header>
  );
}
