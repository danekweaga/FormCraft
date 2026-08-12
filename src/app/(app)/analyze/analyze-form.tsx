"use client";

import { useActionState, useState, useTransition } from "react";
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
  compareAnalysesAction,
  createAnalysisFromUploadAction,
  createAnalysisFromUrlAction,
  createTranscriptAnalysisFromForm,
  type AnalyzeActionState,
} from "./actions";
import { captureVideoFrames } from "./capture-frames";

const initialState: AnalyzeActionState = {};

type AnalysisListItem = {
  id: string;
  title: string | null;
  analysis_mode: string;
  subject_type: string;
  source_type?: string | null;
  status: string;
  has_visual_evidence: boolean;
  saved?: boolean;
  created_at: string;
  input_type?: string | null;
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
  const [tab, setTab] = useState<"paste" | "upload" | "url">("paste");
  const [pasteState, pasteAction, pastePending] = useActionState(
    createTranscriptAnalysisFromForm,
    initialState,
  );
  const [urlState, urlAction, urlPending] = useActionState(
    createAnalysisFromUrlAction,
    initialState,
  );
  const [uploadState, uploadAction, uploadPending] = useActionState(
    createAnalysisFromUploadAction,
    initialState,
  );
  const [framesJson, setFramesJson] = useState("");
  const [framePending, startFrame] = useTransition();

  return (
    <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
      <CardHeader>
        <CardTitle>New analysis</CardTitle>
        <CardDescription>
          Paste a transcript, upload video/audio, or analyze a public YouTube,
          TikTok, Instagram, Facebook, or X link. Supadata retrieves the spoken
          transcript on demand; FormCraft does not claim visual evidence from a link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["paste", "Transcript"],
              ["upload", "Upload"],
              ["url", "Link"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={tab === id ? "default" : "outline"}
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        {tab === "paste" ? (
          <form action={pasteAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={200} />
            </div>
            <ModeSubjectFields />
            <div className="space-y-2">
              <Label htmlFor="transcript">Transcript / script</Label>
              <Textarea
                id="transcript"
                name="transcript"
                required
                rows={10}
                placeholder="Paste transcript, script, or caption…"
              />
            </div>
            {pasteState.error ? (
              <p className="text-sm text-error">{pasteState.error}</p>
            ) : null}
            <Button type="submit" disabled={pastePending}>
              {pastePending ? "Analyzing…" : "Run analysis"}
            </Button>
          </form>
        ) : null}

        {tab === "url" ? (
          <form action={urlAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url-title">Title</Label>
              <Input id="url-title" name="title" maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mode-url">Mode</Label>
              <select
                id="mode-url"
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
              <Label htmlFor="sourceUrl">Public video URL</Label>
              <Input
                id="sourceUrl"
                name="sourceUrl"
                required
                placeholder="https://www.tiktok.com/@creator/video/…"
              />
            </div>
            {urlState.error ? (
              <p className="text-sm text-error">{urlState.error}</p>
            ) : null}
            <Button type="submit" disabled={urlPending}>
              {urlPending ? "Fetching…" : "Analyze from link"}
            </Button>
          </form>
        ) : null}

        {tab === "upload" ? (
          <form action={uploadAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upload-title">Title</Label>
              <Input id="upload-title" name="title" maxLength={200} />
            </div>
            <ModeSubjectFields />
            <div className="space-y-2">
              <Label htmlFor="media">Video / audio file</Label>
              <Input
                id="media"
                name="media"
                type="file"
                accept="video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
                required
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setFramesJson("");
                    return;
                  }
                  startFrame(async () => {
                    const frames = await captureVideoFrames(file, 6);
                    setFramesJson(JSON.stringify(frames));
                  });
                }}
              />
              <p className="text-xs text-secondary">
                {framePending
                  ? "Capturing frames…"
                  : framesJson
                    ? "Frames captured for multimodal notes."
                    : "Requires OPENAI_API_KEY for Whisper. Frames captured in-browser when video."}
              </p>
            </div>
            <input type="hidden" name="framesJson" value={framesJson} />
            {uploadState.error ? (
              <p className="text-sm text-error">{uploadState.error}</p>
            ) : null}
            <Button type="submit" disabled={uploadPending || framePending}>
              {uploadPending ? "Uploading & analyzing…" : "Upload & analyze"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ModeSubjectFields() {
  return (
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
        <Label htmlFor="subjectType">Source type</Label>
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
  );
}

export function AnalysisList({
  analyses,
  filter,
}: {
  analyses: AnalysisListItem[];
  filter?: string;
}) {
  const filtered = analyses.filter((a) => {
    if (!filter || filter === "recent" || filter === "new") return true;
    if (filter === "saved") return Boolean(a.saved);
    if (filter === "own")
      return (
        a.source_type === "my_content" || a.subject_type === "own_content"
      );
    if (filter === "external")
      return (
        a.source_type === "external_research" ||
        a.subject_type === "competitor_reference" ||
        a.subject_type === "viral_outlier"
      );
    if (filter === "draft")
      return a.source_type === "draft" || a.subject_type === "draft";
    return true;
  });

  return (
    <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
      <CardHeader>
        <CardTitle>Library</CardTitle>
        <CardDescription>
          {filtered.length} shown · click to open the breakdown lab
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-secondary">No analyses in this filter.</p>
        ) : (
          filtered.map((analysis) => (
            <Link
              key={analysis.id}
              href={`/analyze/${analysis.id}`}
              className="block rounded-lg border border-outline-variant/20 p-3 hover:bg-surface-container-lowest"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-on-background">
                  {analysis.title || "Untitled analysis"}
                </p>
                <Badge variant="default">{analysis.analysis_mode}</Badge>
                <Badge variant="default">{analysis.status}</Badge>
                {analysis.has_visual_evidence ? (
                  <Badge variant="success">Visual</Badge>
                ) : (
                  <Badge variant="warning">Transcript</Badge>
                )}
                {analysis.saved ? <Badge variant="primary">Saved</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-secondary">
                {(analysis.source_type || analysis.subject_type).replace(
                  /_/g,
                  " ",
                )}{" "}
                · {formatDate(analysis.created_at)}
              </p>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function CompareForm({ analyses }: { analyses: AnalysisListItem[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ready = analyses.filter((a) => a.status === "ready");

  return (
    <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
      <CardHeader>
        <CardTitle>Compare analyses</CardTitle>
        <CardDescription>
          Side-by-side structural compare. More views ≠ better for you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const result = await compareAnalysesAction(fd);
              if (result?.error) setError(result.error);
            });
          }}
        >
          <div className="space-y-2">
            <Label>Left</Label>
            <select
              name="leftId"
              required
              className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
            >
              {ready.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title || a.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Right</Label>
            <select
              name="rightId"
              required
              className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
            >
              {ready.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title || a.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          {error ? <p className="text-sm text-error sm:col-span-2">{error}</p> : null}
          <Button type="submit" disabled={pending || ready.length < 2}>
            {pending ? "Comparing…" : "Compare"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
