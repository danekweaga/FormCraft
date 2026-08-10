"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { MaterialIcon } from "@/components/layout/material-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  normalizeAnalysisResult,
  type AnalysisResult,
  type ProcessingStage,
} from "@/lib/analyze/schema";
import {
  saveEditingPatternFromAnalysisAction,
} from "@/app/(app)/pre-publish/actions";
import {
  addAnalysisToCanvasAction,
  createExperimentFromInsight,
  reanalyzeTranscript,
  saveAnalysisCorrectionsAction,
  savePatternFromAnalysisAction,
  toggleAnalysisSavedAction,
} from "../actions";

type AnalysisDetail = {
  id: string;
  title: string | null;
  analysis_mode: string;
  subject_type: string;
  source_type?: string | null;
  status: string;
  has_visual_evidence: boolean;
  has_audio_evidence?: boolean;
  model_name: string | null;
  prompt_version?: string | null;
  created_at: string;
  transcript?: string | null;
  media_url?: string | null;
  processing_stages?: ProcessingStage[] | null;
  knowledge_sources?: unknown;
  analysis_version?: number | null;
  parent_analysis_id?: string | null;
  saved?: boolean;
  estimated_cost_usd?: number | null;
  result: unknown;
  versions?: Array<{ id: string; analysis_version: number; created_at: string }>;
};

const TABS = [
  "Overview",
  "Structure",
  "Hook",
  "Psychology",
  "Retention",
  "Proof",
  "Editing",
  "Improvements",
] as const;

function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

function StageList({ stages }: { stages: ProcessingStage[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {stages.map((s) => (
        <li key={s.id} className="flex items-center gap-2 text-secondary">
          <span>
            {s.status === "done"
              ? "✓"
              : s.status === "active"
                ? "→"
                : s.status === "skipped"
                  ? "–"
                  : s.status === "error"
                    ? "!"
                    : "○"}
          </span>
          <span className="text-on-background">{s.label}</span>
          {s.detail ? <span className="text-xs">({s.detail})</span> : null}
        </li>
      ))}
    </ul>
  );
}

function StructureMap({
  timeline,
  onSeek,
}: {
  timeline: AnalysisResult["timeline"];
  onSeek: (seconds: number) => void;
}) {
  const max = Math.max(1, ...timeline.map((t) => t.endSeconds));
  return (
    <div className="space-y-2">
      {timeline.map((t, i) => {
        const left = (t.startSeconds / max) * 100;
        const width = Math.max(4, ((t.endSeconds - t.startSeconds) / max) * 100);
        return (
          <button
            key={`${t.type}-${i}`}
            type="button"
            className="relative block h-8 w-full rounded bg-surface-container-lowest text-left"
            onClick={() => onSeek(t.startSeconds)}
            title={`${t.type} ${formatClock(t.startSeconds)}`}
          >
            <span
              className="absolute inset-y-1 rounded border border-outline-variant/40 bg-primary-container/20 px-2 text-[11px] font-semibold text-on-background"
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              {t.type}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function AnalysisDetailClient({ analysis }: { analysis: AnalysisDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const result = useMemo(
    () => (analysis.result ? normalizeAnalysisResult(analysis.result) : null),
    [analysis.result],
  );

  function seek(seconds: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      void videoRef.current.play().catch(() => undefined);
    }
  }

  if (analysis.status === "processing" || analysis.status === "queued") {
    return (
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/analyze">← Back</Link>
        </Button>
        <PageHeader
          title={analysis.title || "Analyzing…"}
          description="Pipeline in progress"
        />
        <StageList stages={analysis.processing_stages ?? []} />
      </div>
    );
  }

  if (!result) {
    return (
      <p className="text-sm text-secondary">
        Analysis result unavailable. Try re-running the analysis.
        {analysis.status === "failed"
          ? " Media/transcript were kept if upload succeeded."
          : ""}
      </p>
    );
  }

  const labeledTranscript = analysis.transcript ?? "";

  const hookLabels = new Map<number, string>();
  result.hooks.forEach((h) => hookLabels.set(Math.floor(h.timestamp), "HOOK"));
  result.rehooks.forEach((h) =>
    hookLabels.set(Math.floor(h.timestamp), "REHOOK"),
  );

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/analyze">
          <MaterialIcon name="arrow_back" className="text-base" />
          Back to analyses
        </Link>
      </Button>

      <PageHeader
        title={analysis.title || "Video breakdown"}
        description={result.overview.coreMessage}
        actions={
          <div className="flex flex-wrap gap-2">
            <form action={toggleAnalysisSavedAction}>
              <input type="hidden" name="id" value={analysis.id} />
              <input
                type="hidden"
                name="saved"
                value={String(!analysis.saved)}
              />
              <Button type="submit" size="sm" variant="outline">
                {analysis.saved ? "Unsave" : "Save"}
              </Button>
            </form>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await createExperimentFromInsight(analysis.id);
                })
              }
            >
              Create experiment
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/pre-publish?analysisId=${analysis.id}`}>
                Pre-Publish Lab
              </Link>
            </Button>
            <form action={saveEditingPatternFromAnalysisAction}>
              <input type="hidden" name="analysisId" value={analysis.id} />
              <input
                type="hidden"
                name="name"
                value={`Editing · ${analysis.title || "pattern"}`}
              />
              <Button type="submit" size="sm" variant="outline">
                Save editing pattern
              </Button>
            </form>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const response = await reanalyzeTranscript(analysis.id);
                  if (response.analysisId) {
                    router.push(`/analyze/${response.analysisId}`);
                  }
                })
              }
            >
              Reanalyze
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const response = await reanalyzeTranscript(analysis.id, {
                    usePremium: true,
                  });
                  if (response.analysisId) {
                    router.push(`/analyze/${response.analysisId}`);
                  }
                })
              }
            >
              Premium reanalyze
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="default">{analysis.analysis_mode}</Badge>
        <Badge variant="default">
          {(analysis.source_type || analysis.subject_type).replace(/_/g, " ")}
        </Badge>
        <Badge variant={analysis.has_visual_evidence ? "success" : "warning"}>
          {analysis.has_visual_evidence ? "Visual evidence" : "Transcript only"}
        </Badge>
        {analysis.analysis_version ? (
          <Badge variant="primary">v{analysis.analysis_version}</Badge>
        ) : null}
        {analysis.model_name ? (
          <Badge variant="default">{analysis.model_name}</Badge>
        ) : null}
        {analysis.estimated_cost_usd != null ? (
          <Badge variant="default">
            ~${Number(analysis.estimated_cost_usd).toFixed(4)}
          </Badge>
        ) : null}
      </div>

      {(analysis.processing_stages?.length ?? 0) > 0 ? (
        <Card className="mb-6 border-outline-variant/20">
          <CardHeader>
            <CardTitle className="text-base">Processing stages</CardTitle>
          </CardHeader>
          <CardContent>
            <StageList stages={analysis.processing_stages ?? []} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_260px]">
        <div className="space-y-4">
          {analysis.media_url ? (
            <video
              ref={videoRef}
              src={analysis.media_url}
              controls
              className="w-full rounded-xl bg-black"
            />
          ) : (
            <div className="rounded-xl border border-outline-variant/20 p-4 text-sm text-secondary">
              No playable media URL. Transcript-only analysis.
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-secondary">
              Transcript
            </p>
            <Input
              placeholder="Search transcript…"
              value={transcriptQuery}
              onChange={(e) => setTranscriptQuery(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-80 overflow-auto rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3 text-xs leading-relaxed text-secondary whitespace-pre-wrap">
              {result.timeline.map((t, i) => {
                const label = hookLabels.get(Math.floor(t.startSeconds));
                const hay = t.transcript;
                if (
                  transcriptQuery &&
                  !hay.toLowerCase().includes(transcriptQuery.toLowerCase())
                ) {
                  return null;
                }
                return (
                  <p key={i} className="mb-2">
                    <button
                      type="button"
                      className="font-semibold text-primary hover:underline"
                      onClick={() => seek(t.startSeconds)}
                    >
                      [{label || t.type}] {formatClock(t.startSeconds)}
                    </button>{" "}
                    {hay}
                  </p>
                );
              })}
              {!result.timeline.length ? labeledTranscript : null}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? "default" : "outline"}
                onClick={() => setTab(t)}
              >
                {t}
              </Button>
            ))}
          </div>

          {tab === "Overview" ? (
            <Card className="border-outline-variant/20">
              <CardHeader>
                <CardTitle>Overview</CardTitle>
                <CardDescription>
                  Topic: {result.overview.topic}
                  {result.overview.intendedAudience
                    ? ` · Audience: ${result.overview.intendedAudience}`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p>{result.overview.coreMessage}</p>
                {result.overview.contentGoal ? (
                  <p className="text-secondary">Goal: {result.overview.contentGoal}</p>
                ) : null}
                <div>
                  <p className="font-semibold">Strengths</p>
                  <ul className="mt-1 list-disc pl-5 text-secondary">
                    {result.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold">Scorecard</p>
                  <ul className="mt-2 space-y-2">
                    {result.scorecard.map((s) => (
                      <li key={s.category}>
                        <div className="flex justify-between gap-2">
                          <span>{s.category}</span>
                          <Badge variant="default">{s.rating}</Badge>
                        </div>
                        <p className="text-xs text-secondary">{s.explanation}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                {result.sourcesUsed.length > 0 ? (
                  <div>
                    <p className="font-semibold">Informed by your knowledge</p>
                    <ul className="mt-1 list-disc pl-5 text-xs text-secondary">
                      {result.sourcesUsed.map((s) => (
                        <li key={`${s.sourceType}-${s.sourceId}`}>
                          {s.sourceType} · {s.sourceId}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {tab === "Structure" ? (
            <Card className="border-outline-variant/20">
              <CardHeader>
                <CardTitle>Structure map</CardTitle>
                <CardDescription>Click a block to seek (when media exists)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <StructureMap timeline={result.timeline} onSeek={seek} />
                <ul className="space-y-3 text-sm">
                  {result.timeline.map((t, i) => (
                    <li key={i} className="rounded-lg border border-outline-variant/15 p-3">
                      <button
                        type="button"
                        className="font-semibold text-primary hover:underline"
                        onClick={() => seek(t.startSeconds)}
                      >
                        {formatClock(t.startSeconds)}–{formatClock(t.endSeconds)} ·{" "}
                        {t.type}
                      </button>
                      <p className="mt-1 text-secondary">{t.purpose}</p>
                      <p className="mt-1 text-xs text-secondary">{t.assessment}</p>
                      <form
                        action={saveAnalysisCorrectionsAction}
                        className="mt-2 flex gap-2"
                      >
                        <input type="hidden" name="analysisId" value={analysis.id} />
                        <input type="hidden" name="sectionIndex" value={String(i)} />
                        <Input
                          name="sectionLabel"
                          placeholder="Correct label"
                          className="h-8"
                        />
                        <Button type="submit" size="sm" variant="ghost">
                          Save
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
                {result.improvedStructure.length > 0 ? (
                  <div>
                    <p className="font-semibold">Improved structure</p>
                    <ul className="mt-2 list-disc pl-5 text-sm text-secondary">
                      {result.improvedStructure.map((s) => (
                        <li key={s.section}>
                          {s.section} ({s.suggestedDuration}) — {s.purpose}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {tab === "Hook" ? (
            <Card className="border-outline-variant/20">
              <CardHeader>
                <CardTitle>Hooks & rehooks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {result.hookStack ? (
                  <div className="rounded-lg bg-surface-container-lowest p-3">
                    <p className="font-semibold">
                      Hook stack · {result.hookStack.primary}
                    </p>
                    <p className="text-secondary">
                      {result.hookStack.mechanisms.join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-secondary">
                      {result.hookStack.assessment}
                    </p>
                  </div>
                ) : null}
                {result.hooks.map((h, i) => (
                  <div key={i} className="rounded-lg border border-outline-variant/15 p-3">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => seek(h.timestamp)}
                    >
                      {formatClock(h.timestamp)}
                    </button>
                    <p className="mt-1 font-medium">{h.text}</p>
                    <p className="text-xs text-secondary">
                      {h.type} · {h.mechanisms.join(", ")}
                    </p>
                    <p className="mt-2 text-secondary">{h.explanation}</p>
                    <p className="mt-1 text-xs">{h.assessment}</p>
                    {i === 0 ? (
                      <form
                        action={saveAnalysisCorrectionsAction}
                        className="mt-2 flex gap-2"
                      >
                        <input type="hidden" name="analysisId" value={analysis.id} />
                        <Input
                          name="hookType"
                          placeholder="Correct hook type"
                          className="h-8"
                        />
                        <Button type="submit" size="sm" variant="ghost">
                          Save
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ))}
                <div>
                  <p className="font-semibold">Rehooks</p>
                  {result.rehooks.length === 0 ? (
                    <p className="text-secondary">None detected</p>
                  ) : (
                    result.rehooks.map((r, i) => (
                      <p key={i} className="mt-1 text-secondary">
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => seek(r.timestamp)}
                        >
                          {formatClock(r.timestamp)}
                        </button>{" "}
                        {r.type}: {r.text}
                      </p>
                    ))
                  )}
                </div>
                <div>
                  <p className="font-semibold">Alternative hooks</p>
                  <ul className="mt-1 list-disc pl-5 text-secondary">
                    {result.improvedHooks.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {tab === "Psychology" ? (
            <Card className="border-outline-variant/20">
              <CardHeader>
                <CardTitle>Viewer psychology</CardTitle>
                <CardDescription>Hypotheses from transcript evidence only</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {result.psychology.map((p, i) => (
                  <div key={i} className="rounded-lg border border-outline-variant/15 p-3">
                    <p className="font-semibold">{p.mechanism}</p>
                    <p className="text-secondary">{p.evidence}</p>
                    <p className="mt-1 text-xs">{p.interpretation}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {tab === "Retention" ? (
            <Card className="border-outline-variant/20">
              <CardHeader>
                <CardTitle>Retention architecture</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {result.observedRetention.length > 0 ? (
                  <div>
                    <p className="font-semibold">Observed retention</p>
                    {result.observedRetention.map((o, i) => (
                      <p key={i} className="text-secondary">
                        {formatClock(o.startSeconds)}–{formatClock(o.endSeconds)}:{" "}
                        {o.note}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-secondary">
                    No observed retention metrics attached. AI notes below are
                    hypotheses only.
                  </p>
                )}
                <div>
                  <p className="font-semibold">Devices</p>
                  <ul className="mt-1 list-disc pl-5 text-secondary">
                    {result.retentionDevices.map((d, i) => (
                      <li key={i}>
                        {formatClock(d.timestamp)} · {d.type}: {d.explanation}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold">Potential retention risks</p>
                  <ul className="mt-1 space-y-2">
                    {(result.retentionRisks.length
                      ? result.retentionRisks
                      : result.potentialRetentionRisks ?? []
                    ).map((r, i) => (
                      <li key={i} className="rounded-lg bg-surface-container-lowest p-3">
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => seek(r.startSeconds)}
                        >
                          {formatClock(r.startSeconds)}–{formatClock(r.endSeconds)}
                        </button>
                        <p>{r.reason || r.risk}</p>
                        <p className="text-xs text-secondary">
                          {r.recommendation || r.suggestion}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold">Open loops</p>
                  {result.openLoops.map((o, i) => (
                    <p key={i} className="mt-1 text-secondary">
                      {formatClock(o.createdAt)}
                      {o.resolvedAt != null
                        ? ` → ${formatClock(o.resolvedAt)}`
                        : " (unresolved)"}
                      : {o.questionCreated || o.text}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {tab === "Proof" ? (
            <Card className="border-outline-variant/20">
              <CardHeader>
                <CardTitle>Claims & proof</CardTitle>
                <CardDescription>No automatic fact-checking</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {result.claims.map((c, i) => (
                  <div key={i} className="rounded-lg border border-outline-variant/15 p-3">
                    <p className="font-medium">{c.claim}</p>
                    <p className="text-xs text-secondary">{c.claimType}</p>
                    <p className="mt-1 text-secondary">{c.assessment}</p>
                    {c.evidenceProvided.length > 0 ? (
                      <ul className="mt-1 list-disc pl-5 text-xs">
                        {c.evidenceProvided.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {tab === "Editing" ? (
            <Card className="border-outline-variant/20">
              <CardHeader>
                <CardTitle>Visual & editing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!analysis.has_visual_evidence ? (
                  <p className="text-secondary">
                    Visual and editing analysis unavailable because no video
                    evidence was provided.
                  </p>
                ) : null}
                {result.visualObservations.map((v, i) => (
                  <p key={i} className="text-secondary">
                    {v.timestamp != null ? `${formatClock(v.timestamp)} · ` : ""}
                    {v.observation}
                  </p>
                ))}
                {result.editingMap.map((e, i) => (
                  <p key={i} className="text-secondary">
                    {formatClock(e.startSeconds)}
                    {e.endSeconds != null ? `–${formatClock(e.endSeconds)}` : ""}
                    : {e.observation}
                  </p>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {tab === "Improvements" ? (
            <Card className="border-outline-variant/20">
              <CardHeader>
                <CardTitle>What I would change</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {(["high", "medium", "optional"] as const).map((priority) => {
                  const items = result.improvements.filter(
                    (i) => i.priority === priority,
                  );
                  if (!items.length) return null;
                  return (
                    <div key={priority}>
                      <p className="font-semibold uppercase tracking-wider text-xs text-secondary">
                        {priority === "optional" ? "Optional polish" : `${priority} priority`}
                      </p>
                      <ul className="mt-2 space-y-3">
                        {items.map((item, i) => (
                          <li
                            key={i}
                            className="rounded-lg border border-outline-variant/15 p-3"
                          >
                            {item.timestamp != null ? (
                              <button
                                type="button"
                                className="text-primary hover:underline"
                                onClick={() => seek(item.timestamp!)}
                              >
                                {formatClock(item.timestamp)}
                              </button>
                            ) : null}
                            <p className="font-medium">{item.issue}</p>
                            <p className="text-secondary">{item.whyItMatters}</p>
                            <p className="mt-1">{item.recommendation}</p>
                            {item.example ? (
                              <p className="mt-1 text-xs text-secondary">
                                Example: {item.example}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card className="border-outline-variant/20">
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <form action={savePatternFromAnalysisAction}>
                <input type="hidden" name="analysisId" value={analysis.id} />
                <Input
                  name="name"
                  placeholder="Pattern name"
                  className="mb-2 h-8"
                />
                <Button type="submit" size="sm" className="w-full">
                  Save pattern
                </Button>
              </form>
              <form action={addAnalysisToCanvasAction}>
                <input type="hidden" name="analysisId" value={analysis.id} />
                <Button type="submit" size="sm" variant="outline" className="w-full">
                  Add to Canvas
                </Button>
              </form>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href="/analyze?tab=compare">Compare…</Link>
              </Button>
              {analysis.subject_type === "draft" ? (
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link href="/idea-gate">Run through Idea Gate</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {(analysis.versions?.length ?? 0) > 0 ? (
            <Card className="border-outline-variant/20">
              <CardHeader>
                <CardTitle className="text-base">Versions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {analysis.versions!.map((v) => (
                  <Link
                    key={v.id}
                    href={`/analyze/${v.id}`}
                    className="block text-primary hover:underline"
                  >
                    v{v.analysis_version} ·{" "}
                    {new Date(v.created_at).toLocaleString()}
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-outline-variant/20">
            <CardHeader>
              <CardTitle className="text-base">Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-xs text-secondary">
                {result.confidenceNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
