"use client";

import { useTransition } from "react";
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
import {
  BUCKET_LABELS,
  CREATIVE_DIRECTION_LABELS,
  type CreativeDirection,
  type EditingBlueprint,
  type FindingBucket,
  type PrePublishLabResult,
} from "@/lib/editing/schema";
import {
  assignReviewToExperimentAction,
  saveEditingFeedbackAction,
  updatePrePublishStatusAction,
} from "./actions";

function formatClock(seconds: number | null | undefined) {
  if (seconds == null) return null;
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

const BUCKET_ORDER: FindingBucket[] = [
  "fix_before_posting",
  "worth_testing",
  "creative_options",
  "optional_polish",
];

export function PrePublishDetailClient({
  review,
  blueprint,
  experiments,
}: {
  review: {
    id: string;
    status: string;
    source_ref: string | null;
    input_text: string;
    analysis_id: string | null;
    content_post_id: string | null;
    creative_direction: string | null;
    editing_plan_id: string | null;
    active_experiment_id: string | null;
    result: PrePublishLabResult;
    created_at: string;
  };
  blueprint: EditingBlueprint | null;
  experiments: Array<{ id: string; hypothesis: string; status: string }>;
}) {
  const [pending, start] = useTransition();
  const result = review.result;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Badge variant="primary">{review.status}</Badge>
        {review.source_ref ? (
          <Badge variant="default">{review.source_ref}</Badge>
        ) : null}
        {review.creative_direction ? (
          <Badge variant="default">
            {CREATIVE_DIRECTION_LABELS[
              review.creative_direction as CreativeDirection
            ] ?? review.creative_direction}
          </Badge>
        ) : null}
        {review.analysis_id ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/analyze/${review.analysis_id}`}>Open Analyze</Link>
          </Button>
        ) : null}
      </div>

      <Card className="border-outline-variant/20">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>{result.confidenceNote}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{result.summary}</p>
          {result.activeExperimentNote ? (
            <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
                Current experiment
              </p>
              <p className="mt-1 text-secondary">{result.activeExperimentNote}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <form action={updatePrePublishStatusAction}>
              <input type="hidden" name="id" value={review.id} />
              <input type="hidden" name="status" value="approved" />
              <Button type="submit" size="sm">
                Mark approved
              </Button>
            </form>
            <form action={updatePrePublishStatusAction}>
              <input type="hidden" name="id" value={review.id} />
              <input type="hidden" name="status" value="needs_revision" />
              <Button type="submit" size="sm" variant="outline">
                Needs revision
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {BUCKET_ORDER.map((bucket) => {
        const items = result.findings.filter((f) => f.bucket === bucket);
        if (!items.length) return null;
        return (
          <Card key={bucket} className="border-outline-variant/20">
            <CardHeader>
              <CardTitle className="text-base">{BUCKET_LABELS[bucket]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item, i) => (
                <div
                  key={`${bucket}-${i}`}
                  className="rounded-lg border border-outline-variant/15 p-3 text-sm"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="default">{item.evidenceKind.replace(/_/g, " ")}</Badge>
                    {item.timestampStart != null ? (
                      <Badge variant="primary">
                        {formatClock(item.timestampStart)}
                        {item.timestampEnd != null
                          ? `–${formatClock(item.timestampEnd)}`
                          : ""}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 font-semibold">{item.title}</p>
                  <p className="mt-1 text-secondary">{item.whyItMatters}</p>
                  <p className="mt-2">{item.suggestion}</p>
                  {item.alternatives.length > 0 ? (
                    <ul className="mt-2 list-disc pl-5 text-xs text-secondary">
                      {item.alternatives.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <Card className="border-outline-variant/20">
        <CardHeader>
          <CardTitle className="text-base">Ready to record</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="font-semibold">Checklist</p>
            <ul className="mt-2 space-y-1">
              {result.checklist.ready.map((c) => (
                <li key={c.id} className="text-secondary">
                  {c.done ? "✓" : "○"} {c.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold">Consider before recording</p>
            <ul className="mt-2 space-y-1">
              {result.checklist.consider.map((c) => (
                <li key={c.id} className="text-secondary">
                  ○ {c.label}
                </li>
              ))}
              {result.checklist.consider.length === 0 ? (
                <li className="text-secondary">Nothing flagged.</li>
              ) : null}
            </ul>
          </div>
        </CardContent>
      </Card>

      {experiments.length > 0 ? (
        <Card className="border-outline-variant/20">
          <CardHeader>
            <CardTitle className="text-base">Assign to experiment</CardTitle>
            <CardDescription>User confirms — nothing auto-assigns.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                start(async () => {
                  await assignReviewToExperimentAction(fd);
                });
              }}
            >
              <input type="hidden" name="reviewId" value={review.id} />
              <select
                name="experimentId"
                className="h-10 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
                defaultValue={review.active_experiment_id ?? experiments[0]?.id}
              >
                {experiments.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    [{ex.status}] {ex.hypothesis.slice(0, 60)}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" disabled={pending}>
                Assign
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {blueprint ? (
        <Card className="border-outline-variant/20">
          <CardHeader>
            <CardTitle>Creative Editing Copilot</CardTitle>
            <CardDescription>
              {blueprint.summary} · {blueprint.confidenceNote}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {blueprint.stylePrinciplesUsed.length > 0 ? (
              <ul className="list-disc pl-5 text-xs text-secondary">
                {blueprint.stylePrinciplesUsed.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
            {blueprint.beats.map((beat, i) => (
              <div
                key={i}
                className="rounded-lg border border-outline-variant/15 p-3 text-sm space-y-1"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge variant="primary">
                    {formatClock(beat.startSeconds)}–{formatClock(beat.endSeconds)}
                  </Badge>
                  <Badge variant="default">
                    {beat.evidenceKind.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p>
                  <span className="font-semibold">Content:</span> {beat.content}
                </p>
                <p>
                  <span className="font-semibold">Keep:</span> {beat.keep}
                </p>
                {beat.optional ? (
                  <p>
                    <span className="font-semibold">Optional:</span>{" "}
                    {beat.optional}
                  </p>
                ) : null}
                <p className="text-secondary">
                  <span className="font-semibold text-on-background">Why:</span>{" "}
                  {beat.why}
                </p>
                <div className="flex flex-wrap gap-1 pt-2">
                  {(
                    [
                      "good",
                      "not_my_style",
                      "too_much",
                      "too_little",
                      "never",
                      "save_preference",
                    ] as const
                  ).map((fb) => (
                    <form key={fb} action={saveEditingFeedbackAction}>
                      <input
                        type="hidden"
                        name="editingPlanId"
                        value={review.editing_plan_id ?? ""}
                      />
                      <input type="hidden" name="reviewId" value={review.id} />
                      <input
                        type="hidden"
                        name="suggestionKey"
                        value={`beat-${i}`}
                      />
                      <input type="hidden" name="feedback" value={fb} />
                      {fb === "save_preference" ? (
                        <input
                          type="hidden"
                          name="note"
                          value={beat.optional || beat.why}
                        />
                      ) : null}
                      <Button type="submit" size="sm" variant="ghost" className="h-7 text-[10px]">
                        {fb.replace(/_/g, " ")}
                      </Button>
                    </form>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-outline-variant/20">
        <CardHeader>
          <CardTitle className="text-base">Script</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-container-lowest p-3 text-xs text-secondary">
            {review.input_text}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
