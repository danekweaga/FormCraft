"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type GapReportView = {
  topic: string;
  potentialGaps: string[];
  oversaturatedAngles: string[];
  audienceSignals: string[];
  myTopics: string[];
  disclaimer: string;
  usedLlm: boolean;
};

export function ContentGapsPanel({
  initial,
}: {
  initial: GapReportView | null;
}) {
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [report, setReport] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
        <CardHeader>
          <CardTitle>Potential content gaps</CardTitle>
          <CardDescription>
            Compares external research, your My Content, and audience questions.
            Always labelled potential unless the dataset is broad.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic e.g. AI for CS students"
            className="min-w-[240px] flex-1"
          />
          <Button
            disabled={pending || topic.trim().length < 2}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await fetch("/api/research/content-gaps", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ topic }),
                });
                const body = (await res.json()) as GapReportView & {
                  error?: string;
                };
                if (!res.ok) {
                  setError(body.error ?? "Could not build gap report");
                  return;
                }
                setReport(body);
              })
            }
          >
            {pending ? "Finding gaps…" : "Find potential gaps"}
          </Button>
          {error ? <p className="w-full text-sm text-error">{error}</p> : null}
        </CardContent>
      </Card>

      {report ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                Potential gaps · {report.topic}
              </CardTitle>
              <CardDescription>{report.disclaimer}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm text-secondary">
                {report.potentialGaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-secondary">
                {report.usedLlm ? "LLM-assisted" : "Deterministic + stored brief"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardHeader>
              <CardTitle className="text-base">Oversaturated angles</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-secondary">
              {report.oversaturatedAngles.join(" · ") || "—"}
            </CardContent>
          </Card>
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
            <CardHeader>
              <CardTitle className="text-base">Audience signals</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-secondary">
              {report.audienceSignals.join(" · ") || "—"}
            </CardContent>
          </Card>
          <Card className="border-outline-variant/20 bg-surface-primary paper-shadow md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Your recent topics</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-secondary">
              {report.myTopics.join(" · ") || "No classified My Content yet"}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
