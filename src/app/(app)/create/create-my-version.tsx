"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createMyVersionAction,
  generateScriptFromDirectionAction,
  type CreateMyVersionState,
  type ScriptGenerationState,
} from "./actions";

const initialDirection: CreateMyVersionState = {};
const initialScript: ScriptGenerationState = {};

export function CreateMyVersion({
  source,
}: {
  source: {
    id: string;
    title: string;
    creator: string | null;
    platform: string;
    hook: string | null;
    outlierScore: number | null;
    externalId: string;
    externalUrl: string;
    thumbnailUrl: string | null;
  };
}) {
  const [directionState, directionAction, directionPending] = useActionState(createMyVersionAction, initialDirection);
  const [scriptState, scriptAction, scriptPending] = useActionState(generateScriptFromDirectionAction, initialScript);
  const [previewFailed, setPreviewFailed] = useState(false);
  const previewUrl =
    source.thumbnailUrl ||
    (source.platform === "youtube"
      ? `https://i.ytimg.com/vi/${source.externalId}/hqdefault.jpg`
      : null);

  return (
    <div className="space-y-6">
      <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
        <div className="relative aspect-video overflow-hidden bg-on-background">
          {previewUrl && !previewFailed ? (
            <Image
              src={previewUrl}
              alt={`Preview for ${source.title}`}
              fill
              sizes="(max-width: 1024px) 100vw, 900px"
              className="object-cover"
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-white/60">
              Preview unavailable. Open the original video below.
            </div>
          )}
        </div>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary">Source research</Badge>
            <Badge variant="default">{source.platform}</Badge>
            {source.outlierScore != null ? <Badge variant="success">{source.outlierScore.toFixed(1)}x creator baseline</Badge> : null}
          </div>
          <CardTitle className="pt-2">{source.title}</CardTitle>
          <CardDescription>{source.creator ?? "Unknown creator"}{source.hook ? ` · Hook: “${source.hook}”` : ""}</CardDescription>
          <div className="pt-2">
            <Button asChild size="sm" variant="outline">
              <a href={source.externalUrl} target="_blank" rel="noopener noreferrer">
                Open original video
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form action={directionAction} className="space-y-4">
            <input type="hidden" name="researchItemId" value={source.id} />
            <div className="space-y-2">
              <Label htmlFor="spin" className="font-headline text-xl font-semibold">What&apos;s your spin?</Label>
              <p className="text-sm text-secondary">Give your actual opinion, experience, interpretation, disagreement, or specific angle. FormCraft will not clone the source.</p>
              <Textarea id="spin" name="spin" rows={8} minLength={20} maxLength={5000} required placeholder="What do you believe about this? What happened to you? What would you add, change, or disagree with?" />
            </div>
            {directionState.error ? <p className="text-sm text-error">{directionState.error}</p> : null}
            <Button type="submit" disabled={directionPending}>{directionPending ? "Developing your angle..." : "Develop my version"}</Button>
          </form>
        </CardContent>
      </Card>

      {directionState.direction ? (
        <Card className="border-primary-container/30 bg-surface-primary paper-shadow">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">Idea Gate: {directionState.gateDecision}</Badge>
              <Badge variant="default">{directionState.usedLlm ? "OpenRouter" : "Deterministic fallback"}</Badge>
            </div>
            <CardTitle className="pt-2">{directionState.direction.topic}</CardTitle>
            <CardDescription>{directionState.direction.coreArgument}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!directionState.usedLlm && directionState.fallbackReason ? (
              <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-on-background">
                {directionState.fallbackReason}
              </p>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {[
                ["Audience problem", directionState.direction.audienceProblem],
                ["Objective + audience", `${directionState.direction.objective} · ${directionState.direction.audienceLevel} audience`],
                ["Suggested format", `${directionState.direction.suggestedFormat}. ${directionState.direction.formatReason}`],
                ["Text hook", directionState.direction.textHook || directionState.direction.suggestedHook],
                ["Spoken hook", directionState.direction.spokenHook || directionState.direction.suggestedHook],
                ["Opening visual", directionState.direction.visualHook],
                ["Personal angle", directionState.direction.personalAngle],
                ["Payoff", directionState.direction.payoff],
                ["CTA", directionState.direction.cta],
                ["Experiment", directionState.direction.experimentVariable],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-surface-container-lowest p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{label}</p>
                  <p className="mt-2 text-sm text-on-background">{value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-outline-variant/20 p-4">
              <p className="text-sm font-semibold text-on-background">Hook alignment</p>
              <p className="mt-2 text-sm text-secondary">{directionState.direction.hookAlignmentNotes}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-on-background">Structure</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-secondary">
                {directionState.direction.structure.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
            <div>
              <p className="text-sm font-semibold text-on-background">Proof plan</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary">
                {(directionState.direction.proofPlan.length ? directionState.direction.proofPlan : directionState.direction.relevantProof).map((proof) => <li key={proof}>{proof}</li>)}
              </ul>
            </div>
            {directionState.direction.claimFlags.length ? (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                <p className="text-sm font-semibold text-on-background">Verify before publishing</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary">
                  {directionState.direction.claimFlags.map((claim) => <li key={claim}>{claim}</li>)}
                </ul>
              </div>
            ) : null}
            <div>
              <p className="text-sm font-semibold text-on-background">How this stays original</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary">
                {directionState.direction.originalityChanges.map((change) => <li key={change}>{change}</li>)}
              </ul>
            </div>
            <div className="rounded-lg border border-primary-container/25 bg-primary-container/5 p-4">
              <p className="text-sm font-semibold text-on-background">How to make this idea stronger</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary">
                {directionState.direction.improvementSuggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
              </ul>
            </div>
            <form action={scriptAction}>
              <input type="hidden" name="ideaGateEvaluationId" value={directionState.ideaGateEvaluationId} />
              <input type="hidden" name="ideaNodeId" value={directionState.ideaNodeId} />
              <input type="hidden" name="boardId" value={directionState.boardId} />
              <Button type="submit" disabled={scriptPending}>{scriptPending ? "Writing in your style..." : "Generate script + packaging"}</Button>
            </form>
            {scriptState.error ? <p className="text-sm text-error">{scriptState.error}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {scriptState.package ? (
        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="primary">Script ready</Badge>
              <Badge variant="default">{scriptState.usedLlm ? "OpenRouter" : "Fallback draft"}</Badge>
            </div>
            <CardTitle className="pt-2">{scriptState.package.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {!scriptState.usedLlm && scriptState.fallbackReason ? (
              <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-on-background">
                {scriptState.fallbackReason}
              </p>
            ) : null}
            <pre className="whitespace-pre-wrap rounded-lg bg-surface-container-lowest p-5 font-sans text-sm leading-relaxed text-on-background">{scriptState.package.script}</pre>
            <div className="flex flex-wrap gap-2">
              <Badge variant={scriptState.package.qualityGateStatus === "Ready" ? "success" : scriptState.package.qualityGateStatus === "Verify" ? "warning" : "default"}>
                Quality gate: {scriptState.package.qualityGateStatus}
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-outline-variant/20 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-secondary">Caption</p><p className="mt-2 whitespace-pre-wrap text-sm">{scriptState.package.caption}</p></div>
              <div className="rounded-lg border border-outline-variant/20 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-secondary">Cover text</p><p className="mt-2 text-sm">{scriptState.package.coverText}</p></div>
              <div className="rounded-lg border border-outline-variant/20 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-secondary">Search terms</p><p className="mt-2 text-sm">{scriptState.package.searchTerms.join(" · ") || "None suggested"}</p></div>
              <div className="rounded-lg border border-outline-variant/20 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-secondary">Thumbnail concept</p><p className="mt-2 text-sm">{scriptState.package.thumbnailConcept}</p></div>
              <div className="rounded-lg border border-outline-variant/20 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-secondary">Opening visual</p><p className="mt-2 text-sm">{scriptState.package.openingVisual}</p></div>
              <div className="rounded-lg border border-outline-variant/20 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-secondary">Payoff + CTA</p><p className="mt-2 text-sm">{scriptState.package.payoff}</p><p className="mt-2 text-sm text-secondary">{scriptState.package.primaryCTA}</p></div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["Rehooks", scriptState.package.rehooks],
                ["Proof beats", scriptState.package.proofBeats],
                ["Quality checks", scriptState.package.qualityGateNotes],
              ].map(([label, items]) => (
                <div key={label as string} className="rounded-lg bg-surface-container-lowest p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{label as string}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-on-background">
                    {(items as string[]).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link href={`/pre-publish?scriptNode=${scriptState.scriptNodeId}`}>Continue to Pre-Publish</Link></Button>
              {scriptState.boardId ? <Button asChild variant="outline"><Link href={`/canvas/${scriptState.boardId}`}>Open lineage on Canvas</Link></Button> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
