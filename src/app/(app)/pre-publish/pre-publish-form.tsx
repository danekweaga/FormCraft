"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CREATIVE_DIRECTION_LABELS,
  creativeDirections,
  type CreativeDirection,
} from "@/lib/editing/schema";
import { createTranscriptAnalysis } from "@/app/(app)/analyze/actions";
import {
  createPrePublishReview,
  type PrePublishActionState,
} from "./actions";

const initial: PrePublishActionState = {};

export function PrePublishForm({
  analyses = [],
  posts = [],
  styleProfiles = [],
  defaultAnalysisId,
  defaultTranscript,
  defaultTitle,
}: {
  analyses?: Array<{ id: string; title: string | null }>;
  posts?: Array<{ id: string; title: string | null }>;
  styleProfiles?: Array<{ id: string; name: string }>;
  defaultAnalysisId?: string;
  defaultTranscript?: string;
  defaultTitle?: string;
}) {
  const [state, action, pending] = useActionState(createPrePublishReview, initial);
  const [runCopilot, setRunCopilot] = useState(false);
  const [direction, setDirection] = useState<CreativeDirection>("minimal_yap");
  const [breakdownPending, startBreakdown] = useTransition();
  const router = useRouter();

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow"
    >
      <div>
        <h2 className="font-headline text-xl font-semibold text-on-background">
          Pre-Publish Lab
        </h2>
        <p className="mt-1 text-sm text-secondary">
          What is worth fixing before you publish — without pretending editing
          has one correct answer.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sourceRef">Optional label</Label>
        <Input
          id="sourceRef"
          name="sourceRef"
          defaultValue={defaultTitle}
          placeholder="Draft title"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="analysisId">Link Analyze result</Label>
          <select
            id="analysisId"
            name="analysisId"
            defaultValue={defaultAnalysisId ?? ""}
            className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
          >
            <option value="">None</option>
            {analyses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title || a.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contentPostId">Link My Content</Label>
          <select
            id="contentPostId"
            name="contentPostId"
            defaultValue=""
            className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
          >
            <option value="">None</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title || p.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="inputText">Script / transcript</Label>
        <Textarea
          id="inputText"
          name="inputText"
          required
          rows={12}
          defaultValue={defaultTranscript}
        />
      </div>

      <div className="rounded-lg border border-outline-variant/20 p-3 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="runEditingCopilot"
            value="true"
            checked={runCopilot}
            onChange={(e) => setRunCopilot(e.target.checked)}
          />
          Run Creative Editing Copilot (requires direction)
        </label>
        <div className="space-y-2">
          <Label htmlFor="creativeDirection">Creative direction</Label>
          <select
            id="creativeDirection"
            name="creativeDirection"
            value={direction}
            onChange={(e) =>
              setDirection(e.target.value as CreativeDirection)
            }
            className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
          >
            {creativeDirections.map((d) => (
              <option key={d} value={d}>
                {CREATIVE_DIRECTION_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
        {direction === "custom" ? (
          <div className="space-y-2">
            <Label htmlFor="customDirectionBrief">Custom brief</Label>
            <Textarea
              id="customDirectionBrief"
              name="customDirectionBrief"
              rows={3}
              placeholder="Describe how this video should feel…"
            />
          </div>
        ) : null}
        {direction === "reference" || direction === "my_style" ? (
          <div className="space-y-2">
            <Label htmlFor="styleProfileId">Style profile (optional)</Label>
            <select
              id="styleProfileId"
              name="styleProfileId"
              defaultValue=""
              className="flex h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
            >
              <option value="">Auto / linked analysis</option>
              {styleProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Reviewing…" : "Run Pre-Publish Lab"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={breakdownPending}
          onClick={() => {
            const form = document.getElementById(
              "inputText",
            ) as HTMLTextAreaElement | null;
            const titleInput = document.getElementById(
              "sourceRef",
            ) as HTMLInputElement | null;
            const transcript = form?.value?.trim() ?? "";
            if (transcript.length < 20) return;
            startBreakdown(async () => {
              const result = await createTranscriptAnalysis({
                title: titleInput?.value?.trim() || "Draft analysis",
                transcript,
                mode: "deep",
                subjectType: "draft",
                sourceType: "draft",
                inputType: "transcript_paste",
              });
              if (result.analysisId) {
                router.push(`/analyze/${result.analysisId}`);
              }
            });
          }}
        >
          {breakdownPending ? "Opening lab…" : "Analyze Draft"}
        </Button>
      </div>
    </form>
  );
}
