import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CreatorProfileAudit } from "@/lib/persona/profile-audit";

const statusLabel: Record<CreatorProfileAudit["status"], string> = {
  on_strategy: "On strategy",
  mixed: "Mixed direction",
  drifting: "Potential drift",
  insufficient_data: "Needs more evidence",
};

export function ProfileAuditPanel({ audit }: { audit: CreatorProfileAudit }) {
  const statusVariant =
    audit.status === "on_strategy"
      ? "success"
      : audit.status === "drifting"
        ? "warning"
        : "primary";

  return (
    <section className="space-y-4" aria-labelledby="profile-audit-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="profile-audit-title"
            className="font-headline text-2xl font-semibold text-on-background"
          >
            Content alignment audit
          </h2>
          <p className="mt-1 text-sm text-secondary">
            Compares your saved direction with up to 60 recent owned posts. It
            describes overlap; it does not claim a topic caused performance.
          </p>
        </div>
        <Badge variant={statusVariant}>{statusLabel[audit.status]}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Direction match</CardTitle>
            <CardDescription>Recent posts overlapping your saved promise or pillars.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-headline text-4xl font-semibold text-on-background">
              {audit.alignmentPercent == null ? "—" : `${audit.alignmentPercent}%`}
            </p>
            <p className="mt-2 text-sm text-secondary">
              {audit.alignedPosts} of {audit.totalPosts} sampled posts aligned
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface-primary paper-shadow lg:col-span-2">
          <CardHeader>
            <CardTitle>What you actually post about</CardTitle>
            <CardDescription>Topics and pillars already stored on your owned posts.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {audit.topThemes.length > 0 ? (
              audit.topThemes.map((theme) => (
                <Badge key={theme.name} variant="default">
                  {theme.name} · {theme.posts}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-secondary">
                No classified owned posts yet. Sync or classify posts first.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Pillar coverage</CardTitle>
            <CardDescription>Whether each approved pillar appeared recently.</CardDescription>
          </CardHeader>
          <CardContent>
            {audit.pillarCoverage.length > 0 ? (
              <ul className="space-y-2">
                {audit.pillarCoverage.map((pillar) => (
                  <li
                    key={pillar.pillar}
                    className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-lowest px-3 py-2"
                  >
                    <span className="text-sm font-medium text-on-background">
                      {pillar.pillar}
                    </span>
                    <Badge variant={pillar.covered ? "success" : "warning"}>
                      {pillar.posts} posts
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-secondary">
                Add your intended pillars below to begin coverage tracking.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Bio check</CardTitle>
            <CardDescription>Clarity checks for your saved public-bio reference.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {audit.bioChecks.map((check) => (
                <li key={check.label} className="flex gap-3">
                  <span
                    className={
                      check.passed
                        ? "mt-1 size-2 shrink-0 rounded-full bg-success"
                        : "mt-1 size-2 shrink-0 rounded-full bg-warning"
                    }
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-medium text-on-background">
                      {check.label}
                    </p>
                    <p className="text-xs leading-relaxed text-secondary">
                      {check.note}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary-container/30 bg-surface-primary paper-shadow">
        <CardHeader>
          <CardTitle>What to adjust next</CardTitle>
          <CardDescription>
            Change the profile only when repeated content evidence reflects an
            intentional direction—not because one post performed differently.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm leading-relaxed text-on-background">
            {audit.recommendations.map((recommendation) => (
              <li key={recommendation}>• {recommendation}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

