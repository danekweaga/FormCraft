import Link from "next/link";
import { MaterialIcon } from "@/components/layout/material-icon";

export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-outline-variant/20">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-primary-container text-white paper-shadow">
              <MaterialIcon
                name="workspace_premium"
                className="text-lg text-white"
              />
            </div>
            <div>
              <p className="font-headline text-xl font-bold leading-none tracking-tight">
                FormCraft
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">
                Creator Intelligence
              </p>
            </div>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-secondary">
            <Link href="/terms" className="hover:text-on-background">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-on-background">
              Privacy
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-12">{children}</main>

      <footer className="border-t border-outline-variant/15 px-6 py-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 text-xs text-secondary sm:flex-row sm:items-center sm:justify-between">
          <p>FormCraft · Personal creator intelligence</p>
          <Link href="/" className="hover:text-on-background">
            Back to home
          </Link>
        </div>
      </footer>
    </div>
  );
}
