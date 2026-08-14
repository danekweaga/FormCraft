import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { MaterialIcon } from "@/components/layout/material-icon";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 80% at 8% 0%, rgba(20,20,20,0.06) 0%, transparent 55%), radial-gradient(90% 70% at 92% 18%, rgba(255,255,255,0.9) 0%, transparent 52%), linear-gradient(180deg, #fafaf8 0%, #ecece8 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.28] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")",
        }}
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-10">
        <div className="flex items-center gap-3">
          <BrandMark size={36} />
          <div>
            <p className="font-headline text-xl font-bold leading-none tracking-tight">
              FormCraft
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">
              Creator Intelligence
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="rounded-full px-4 py-2 text-sm font-semibold text-secondary transition-colors hover:bg-surface-container-low hover:text-on-background"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-transform active:scale-[0.98] shadow-sm"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main>
        <section className="relative mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-6xl flex-col justify-end px-6 pb-16 pt-10 md:px-10 md:pb-24">
          <div className="grid items-end gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="animate-fc-rise mb-4 font-headline text-5xl font-bold tracking-tight text-on-background md:text-7xl lg:text-8xl">
                FormCraft
              </p>
              <h1
                className="animate-fc-rise max-w-xl font-headline text-2xl font-semibold leading-snug text-on-background md:text-3xl"
                style={{ animationDelay: "80ms" }}
              >
                Know what to make next—and why.
              </h1>
              <p
                className="animate-fc-rise mt-5 max-w-lg text-base leading-relaxed text-secondary md:text-lg"
                style={{ animationDelay: "140ms" }}
              >
                Personal creator intelligence that learns from your knowledge,
                your content, and your experiments.
              </p>
              <div
                className="animate-fc-rise mt-8 flex flex-wrap items-center gap-3"
                style={{ animationDelay: "200ms" }}
              >
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-full bg-primary-container px-7 py-3.5 text-sm font-semibold text-on-primary-container transition-transform hover:opacity-95 active:scale-[0.98] shadow-sm"
                >
                  Start building
                  <MaterialIcon name="arrow_forward" className="text-base" />
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest/80 px-7 py-3.5 text-sm font-semibold text-on-background backdrop-blur transition-colors hover:bg-surface-container-lowest"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div
              className="animate-fc-fade-slide relative lg:col-span-5"
              style={{ animationDelay: "180ms" }}
            >
              <div className="relative overflow-hidden rounded-2xl border border-outline-variant/25 bg-surface-primary shadow-sm">
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.12]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(-12deg, transparent, transparent 12px, rgba(24,28,33,0.04) 12px, rgba(24,28,33,0.04) 13px)",
                  }}
                />
                <div className="relative z-10 flex min-h-[320px] flex-col justify-between p-8 md:min-h-[380px] md:p-10">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                      Operating loop
                    </p>
                    <p className="mt-4 font-headline text-2xl font-semibold leading-snug text-on-background md:text-3xl">
                      Teach → Aim → Create → Measure → Learn
                    </p>
                  </div>
                  <div className="space-y-3 text-sm text-on-surface-variant">
                    <p className="border-l-2 border-primary-container pl-3">
                      Roadmap knows your bottleneck
                    </p>
                    <p className="border-l-2 border-primary-container/60 pl-3">
                      Knowledge shapes every draft
                    </p>
                    <p className="border-l-2 border-primary-container/30 pl-3">
                      Experiments turn guesses into lessons
                    </p>
                  </div>
                </div>
                <div
                  aria-hidden
                  className="absolute right-6 top-0 flex h-full items-end gap-1.5 py-8 opacity-20"
                >
                  <div className="h-24 w-3 bg-primary-container" />
                  <div className="h-16 w-3 bg-primary-container/70" />
                  <div className="h-32 w-3 bg-primary-container/40" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-outline-variant/20 bg-surface-container-lowest/50">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-3 md:px-10">
            {[
              {
                title: "Teach FormCraft",
                body: "Upload strategy notes, voice rules, and examples so every future draft starts informed.",
                icon: "school",
              },
              {
                title: "Learn from your work",
                body: "Track what actually performs for you—not generic benchmarks—and confirm the lessons that stick.",
                icon: "insights",
              },
              {
                title: "Decide with evidence",
                body: "Roadmaps, experiments, and idea gates keep you focused on the next move that matters.",
                icon: "flag",
              },
            ].map((item) => (
              <div key={item.title} className="max-w-sm">
                <MaterialIcon name={item.icon} className="text-primary" />
                <h2 className="mt-4 font-headline text-xl font-semibold text-on-background">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-secondary">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-outline-variant/15 px-6 py-8 md:px-10">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p className="font-headline text-lg font-bold">FormCraft</p>
            <div className="flex flex-col gap-2 text-xs text-secondary sm:items-end">
              <p>Personal creator intelligence · Built for one focused operator</p>
              <div className="flex items-center gap-4">
                <Link href="/terms" className="hover:text-on-background">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="hover:text-on-background">
                  Privacy Policy
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
