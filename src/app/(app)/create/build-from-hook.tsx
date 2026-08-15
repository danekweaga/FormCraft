"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildScriptFromHookAction,
  gradeAndImproveScriptAction,
  reviseScriptWithFeedbackAction,
  type HookBuildState,
} from "./actions";

const initial: HookBuildState = {};

export function BuildFromHookStudio({
  hook,
  hookType,
  topic,
}: {
  hook: string;
  hookType?: string | null;
  topic?: string | null;
}) {
  const [tab, setTab] = useState<"ideas" | "grade">("ideas");
  const [generateState, generateAction, generatePending] = useActionState(
    buildScriptFromHookAction,
    initial,
  );
  const [reviseState, reviseAction, revisePending] = useActionState(
    reviseScriptWithFeedbackAction,
    initial,
  );
  const [gradeState, gradeAction, gradePending] = useActionState(
    gradeAndImproveScriptAction,
    initial,
  );

  const activePackage =
    reviseState.package ?? generateState.package ?? gradeState.package ?? null;
  const boardId =
    reviseState.boardId ?? generateState.boardId ?? gradeState.boardId;
  const scriptNodeId =
    reviseState.scriptNodeId ??
    generateState.scriptNodeId ??
    gradeState.scriptNodeId;
  const review = gradeState.review;
  const error =
    (tab === "ideas"
      ? reviseState.error || generateState.error
      : gradeState.error) ?? null;

  return (
    <div className="space-y-6">
      <Card className="border-primary-container/30 bg-surface-primary paper-shadow">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary">From Hooks</Badge>
            {hookType ? <Badge variant="default">{hookType}</Badge> : null}
            {topic ? <Badge variant="default">{topic}</Badge> : null}
          </div>
          <CardTitle className="pt-2 font-headline text-2xl leading-snug">
            “{hook}”
          </CardTitle>
          <CardDescription>
            Paste your ideas to draft a script, then mark what to keep or change.
            Or paste a script from elsewhere and FormCraft will grade and improve
            it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex rounded-full bg-surface-container-low p-1 w-fit">
            {(
              [
                ["ideas", "Ideas → script"],
                ["grade", "Paste & grade"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={
                  tab === value
                    ? "rounded-full bg-surface-primary px-3.5 py-1.5 text-xs font-semibold text-on-background paper-shadow"
                    : "rounded-full px-3.5 py-1.5 text-xs font-semibold text-secondary hover:text-on-background"
                }
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "ideas" ? (
            <form action={generateAction} className="space-y-4">
              <input type="hidden" name="hook" value={hook} />
              <input type="hidden" name="hookType" value={hookType ?? ""} />
              <input type="hidden" name="topic" value={topic ?? ""} />
              <div className="space-y-2">
                <Label htmlFor="ideas">Your ideas / talking points</Label>
                <Textarea
                  id="ideas"
                  name="ideas"
                  rows={8}
                  minLength={20}
                  maxLength={8000}
                  required
                  placeholder="Dump the points you want in the video — stories, opinions, examples, CTA. Messy notes are fine."
                />
              </div>
              <Button type="submit" disabled={generatePending}>
                {generatePending ? "Writing script…" : "Create script from ideas"}
              </Button>
            </form>
          ) : (
            <form action={gradeAction} className="space-y-4">
              <input type="hidden" name="hook" value={hook} />
              <div className="space-y-2">
                <Label htmlFor="pastedScript">Paste a script to grade</Label>
                <Textarea
                  id="pastedScript"
                  name="pastedScript"
                  rows={10}
                  minLength={40}
                  maxLength={12_000}
                  required
                  placeholder="Paste a draft from Notes, ChatGPT, CapCut, or anywhere else…"
                />
              </div>
              <Button type="submit" disabled={gradePending}>
                {gradePending ? "Grading…" : "Grade & improve"}
              </Button>
            </form>
          )}

          {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
        </CardContent>
      </Card>

      {review ? (
        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="primary">Grade {review.overallGrade}</Badge>
              <Badge variant="default">Review</Badge>
            </div>
            <CardTitle className="pt-2">{review.title}</CardTitle>
            <CardDescription>{review.summary}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-surface-container-lowest p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                Strengths
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                {review.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-surface-container-lowest p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                Weaknesses
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                {review.weaknesses.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {review.keepAsIs.length ? (
              <div className="rounded-lg border border-outline-variant/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  Keep
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  {review.keepAsIs.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {review.changeNext.length ? (
              <div className="rounded-lg border border-outline-variant/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  Change next
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  {review.changeNext.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activePackage ? (
        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">Script draft</Badge>
              <Badge variant="default">
                {(reviseState.usedLlm ??
                  generateState.usedLlm ??
                  gradeState.usedLlm)
                  ? "AI"
                  : "Draft"}
              </Badge>
              <Badge
                variant={
                  activePackage.qualityGateStatus === "Ready"
                    ? "success"
                    : activePackage.qualityGateStatus === "Verify"
                      ? "warning"
                      : "default"
                }
              >
                {activePackage.qualityGateStatus}
              </Badge>
            </div>
            <CardTitle className="pt-2">{activePackage.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <pre className="whitespace-pre-wrap rounded-lg bg-surface-container-lowest p-5 font-sans text-sm leading-relaxed text-on-background">
              {activePackage.script}
            </pre>

            <form action={reviseAction} className="space-y-4 rounded-xl border border-outline-variant/20 p-4">
              <input type="hidden" name="hook" value={hook} />
              <input type="hidden" name="currentScript" value={activePackage.script} />
              <input type="hidden" name="boardId" value={boardId ?? ""} />
              <input type="hidden" name="scriptNodeId" value={scriptNodeId ?? ""} />
              <p className="text-sm font-semibold text-on-background">
                What do you want next?
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="likeParts">Parts you like (keep)</Label>
                  <Textarea
                    id="likeParts"
                    name="likeParts"
                    rows={4}
                    maxLength={4000}
                    placeholder="e.g. Keep the opening line and the internship story…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="changeParts">Parts to change</Label>
                  <Textarea
                    id="changeParts"
                    name="changeParts"
                    rows={4}
                    maxLength={4000}
                    placeholder="e.g. Make the middle tighter, soften the CTA, add a CS example…"
                  />
                </div>
              </div>
              <Button type="submit" disabled={revisePending} variant="outline">
                {revisePending ? "Revising…" : "Revise with my notes"}
              </Button>
              {reviseState.error ? (
                <p className="text-sm text-error">{reviseState.error}</p>
              ) : null}
            </form>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-outline-variant/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  Caption
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {activePackage.caption}
                </p>
              </div>
              <div className="rounded-lg border border-outline-variant/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  Cover text
                </p>
                <p className="mt-2 text-sm">{activePackage.coverText}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {scriptNodeId ? (
                <Button asChild>
                  <Link href={`/pre-publish?scriptNode=${scriptNodeId}`}>
                    Continue to Pre-Publish
                  </Link>
                </Button>
              ) : null}
              {boardId ? (
                <Button asChild variant="outline">
                  <Link href={`/canvas/${boardId}`}>Open on Canvas</Link>
                </Button>
              ) : null}
              <Button asChild variant="ghost">
                <Link href="/hooks">Back to Hooks</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
