import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { MaterialIcon } from "@/components/layout/material-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TodayPage() {
  return (
    <div>
      <PageHeader
        title="Today"
        description="Your command centre for what matters right now — priority focus, active work, and the next moves in your creator pipeline."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MaterialIcon
                name="flag"
                className="text-primary-container"
                filled
              />
              <CardTitle>Priority Focus</CardTitle>
            </div>
            <CardDescription>
              Demo briefing — not persisted. Replace with live priorities in a
              later phase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
                This week
              </p>
              <h2 className="mt-2 font-headline text-2xl font-semibold text-on-background">
                Ship the audience research brief
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary">
                Turn last month&apos;s performance notes into three testable
                content angles. Pull voice examples from Teach FormCraft, then
                draft hooks in Create before Friday&apos;s recording block.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Research",
                  detail: "Scan 5 competitor hooks in your niche",
                },
                {
                  label: "Draft",
                  detail: "Outline the hero video script",
                },
                {
                  label: "Review",
                  detail: "Check analytics on last upload",
                },
              ].map((item) => (
                <li
                  key={item.label}
                  className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest/60 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm text-on-background">{item.detail}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <EmptyState
          className="lg:col-span-2"
          title="Active Work"
          description="Nothing in progress yet. Next priorities in the Creator Growth loop: set a Roadmap goal, then log an Experiment hypothesis — still no fake pipeline data."
          action={
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="default">
                <Link href="/roadmap">
                  <MaterialIcon name="flag" className="text-base" />
                  Roadmap
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/experiments">
                  <MaterialIcon name="science" className="text-base" />
                  Experiments
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/knowledge">
                  <MaterialIcon name="school" className="text-base" />
                  Teach FormCraft
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/my-content">
                  <MaterialIcon name="movie" className="text-base" />
                  My Content
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
