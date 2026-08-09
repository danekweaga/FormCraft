"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { createClient } from "@/lib/supabase/client";

export function UserMenu({
  email,
  displayName,
}: {
  email?: string | null;
  displayName?: string | null;
}) {
  const router = useRouter();
  const initials = (displayName || email || "U")
    .slice(0, 1)
    .toUpperCase();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-outline-variant/20 bg-surface-variant text-xs font-bold text-on-surface"
          aria-label="User menu"
        >
          {initials}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-48 rounded-lg border border-outline-variant/20 bg-surface p-1 shadow-lg"
        >
          <div className="border-b border-outline-variant/15 px-3 py-2">
            <p className="truncate text-sm font-semibold">{displayName || "Creator"}</p>
            <p className="truncate text-xs text-secondary">{email}</p>
          </div>
          <DropdownMenu.Item asChild>
            <Link
              href="/profile"
              className="block rounded-md px-3 py-2 text-sm outline-none hover:bg-surface-container-low"
            >
              Profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link
              href="/settings"
              className="block rounded-md px-3 py-2 text-sm outline-none hover:bg-surface-container-low"
            >
              Settings
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none hover:bg-surface-container-low"
            onSelect={(event) => {
              event.preventDefault();
              void signOut();
            }}
          >
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
