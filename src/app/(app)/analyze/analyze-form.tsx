"use client";

import { useActionState } from "react";
import Link from "next/link";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  analysisModes,
  analysisSubjectTypes,
} from "@/lib/analyze/schema";
import {
  createTranscriptAnalysisFromForm,
  type AnalyzeActionState,
} from "./actions";

const initialState: AnalyzeActionState = {};

type AnalysisListItem = {
  id: string;
  title: string | null;
  analysis_mode: string;
  subject_type: string;
  status: string;
  has_visual_evidence: boolean;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AnalyzeForm() {
  const [state, formAction, isPending] = useActionState(
    createTranscriptAnalysisFromForm,
    initialState,
  );

  return (
    <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
      <CardHeader>
        <CardTitle>New transcript analysis</CardTitle>
        <CardDescription>
          Paste a transcript for a rule-based structural breakdown. No LLM calls —
          honest limits when visual evidence is absent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mode">Mode</Label>
              <select
                id="mode"
                name="mode"
                defaultValue="deep"
                className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
              >
                {analysisModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subjectType">Subject type</Label>
              <select
                id="subjectType"
                name="subjectType"
                defaultValue="unknown"
                className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
              >
                {analysisSubjectTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transcript">Transcript</Label>
            <Textarea
              id="transcript"
              name="transcript"
              required
              rows={10}
              placeholder="Paste your video transcript here…"
            />
          </div>
          {state.error ? <p className="text-sm text-error">{state.error}</p> : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Analyzing…" : "Analyze transcript"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function AnalysisList({ analyses }: { analyses: AnalysisListItem[] }) {
  if (analyses.length === 0) return null;

  return (
    <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
      <CardHeader>
        <CardTitle>Past analyses</CardTitle>
        <CardDescription>
          Previously saved transcript breakdowns for this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-outline-variant/15">
          {analyses.map((analysis) => (
            <li key={analysis.id}>
              <Link
                href={`/analyze/${analysis.id}`}
                className="flex flex-wrap items-center justify-between gap-3 py-4 transition-colors hover:text-primary-container"
              >
                <div>
                  <p className="font-medium text-on-background">
                    {analysis.title || "Untitled analysis"}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    {formatDate(analysis.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">{analysis.analysis_mode}</Badge>
                  <Badge variant="default">
                    {analysis.subject_type.replace(/_/g, " ")}
                  </Badge>
                  {!analysis.has_visual_evidence ? (
                    <Badge variant="warning">No visual evidence</Badge>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
