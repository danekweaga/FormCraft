"use client";

import { useTransition } from "react";
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
import type { AnalysisResult } from "@/lib/analyze/schema";
import { reanalyzeTranscript } from "../actions";

type AnalysisDetail = {
  id: string;
  title: string | null;
  analysis_mode: string;
  subject_type: string;
  status: string;
  has_visual_evidence: boolean;
  created_at: string;
  result: AnalysisResult | null;
};

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 rounded-full bg-surface-container-high">
        <div
          className="h-2 rounded-full bg-primary-container"
          style={{ width: `${Math.min(score * 10, 100)}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-on-background">{score}/10</span>
    </div>
  );
}

export function AnalysisDetailClient({ analysis }: { analysis: AnalysisDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const result = analysis.result;

  if (!result) {
    return (
      <p className="text-sm text-secondary">
        Analysis result unavailable. Try re-running the analysis.
      </p>
    );
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/analyze">
          <MaterialIcon name="arrow_back" className="text-base" />
          Back to analyses
        </Link>
      </Button>

      <PageHeader
        title={analysis.title || "Transcript analysis"}
        description={result.overview}
        actions={
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
            <MaterialIcon name="refresh" className="text-base" />
            Reanalyze
          </Button>
        }
      />

      {!analysis.has_visual_evidence ? (
        <div className="mb-6 rounded-lg border border-outline-variant/20 bg-surface-alt/40 p-4 text-sm text-secondary">
          <MaterialIcon
            name="visibility_off"
            className="mr-1 inline text-base text-primary-container"
          />
          No visual evidence was available. Timeline and retention notes are
          inferred from transcript text only.
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="default">{analysis.analysis_mode}</Badge>
        <Badge variant="default">
          {analysis.subject_type.replace(/_/g, " ")}
        </Badge>
        <Badge variant={analysis.status === "ready" ? "success" : "warning"}>
          {analysis.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow lg:col-span-2">
          <CardHeader>
            <CardTitle>Scorecard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.scorecard.map((entry) => (
              <div key={entry.category}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-on-background">
                    {entry.category}
                  </p>
                </div>
                <ScoreBar score={entry.score} />
                <p className="mt-1 text-xs text-secondary">{entry.rationale}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>Section-by-section transcript map</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {result.timeline.map((entry, index) => (
                <li
                  key={`${entry.startLabel}-${index}`}
                  className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary-container">
                    {entry.startLabel}
                    {entry.endLabel ? ` → ${entry.endLabel}` : ""}
                  </p>
                  <p className="mt-2 text-sm font-medium text-on-background">
                    {entry.purpose}
                  </p>
                  <p className="mt-2 text-sm text-secondary">{entry.segment}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Improvements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {result.improvements.map((item, index) => (
                <li
                  key={`${item.area}-${index}`}
                  className="rounded-lg border border-outline-variant/15 p-4"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-on-background">{item.area}</p>
                    {item.priority ? (
                      <Badge variant="warning">{item.priority}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-secondary">{item.suggestion}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow lg:col-span-2">
          <CardHeader>
            <CardTitle>Confidence notes</CardTitle>
            <CardDescription>What this analysis can and cannot tell you</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-secondary">
              {result.confidenceNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Hooks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {result.hooks.map((hook, index) => (
                <li key={index} className="text-sm">
                  <Badge variant="default">{hook.type}</Badge>
                  <Badge variant="primary" className="ml-2">
                    {hook.effectiveness}
                  </Badge>
                  <p className="mt-2 text-on-background">{hook.text}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-secondary">
              {result.strengths.map((strength) => (
                <li key={strength}>{strength}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
