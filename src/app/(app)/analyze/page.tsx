import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import {
  deleteAnalysisComparisonAction,
  deleteSavedPatternAction,
} from "./actions";
import {
  AnalysisList,
  AnalyzeForm,
  CompareForm,
} from "./analyze-form";

export const maxDuration = 60;

const TABS = [
  { id: "new", label: "New" },
  { id: "recent", label: "Recent" },
  { id: "saved", label: "Saved" },
  { id: "own", label: "Own Content" },
  { id: "external", label: "External" },
  { id: "compare", label: "Compare" },
] as const;

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; comparison?: string }>;
}) {
  const { tab: tabRaw, comparison } = await searchParams;
  const tab = TABS.some((t) => t.id === tabRaw) ? tabRaw! : "new";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: analyses } = await supabase
    .from("video_analyses")
    .select(
      "id, title, analysis_mode, subject_type, source_type, status, has_visual_evidence, saved, created_at, input_type",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);

  const { data: savedPatterns } = await supabase
    .from("saved_patterns")
    .select("id, name, pattern_type, created_at, source_analysis_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);

  let comparisonResult: {
    id: string;
    result: Record<string, unknown>;
    left_analysis_id: string;
    right_analysis_id: string;
  } | null = null;
  if (comparison) {
    const { data } = await supabase
      .from("analysis_comparisons")
      .select("id, result, left_analysis_id, right_analysis_id")
      .eq("id", comparison)
      .eq("user_id", user.id)
      .maybeSingle();
    comparisonResult = data;
  }

  return (
    <div>
      <PageHeader
        title="Video Breakdown Lab"
        description="Give FormCraft a video, link, transcript, or existing post — get evidence-aware structure, psychology, and specific changes. Visual claims stay disabled without frames."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/analyze?tab=${t.id}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === t.id
                ? "bg-primary text-on-primary"
                : "border border-outline-variant/30 text-secondary hover:text-on-background"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "new" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <AnalyzeForm />
          {(analyses?.length ?? 0) > 0 ? (
            <AnalysisList analyses={analyses ?? []} filter="recent" />
          ) : (
            <EmptyState
              title="No analyses yet"
              description="Paste a transcript, upload media, or break down a Research outlier."
            />
          )}
        </div>
      ) : null}

      {tab === "compare" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <CompareForm analyses={analyses ?? []} />
          {comparisonResult ? (
            <div className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4 paper-shadow">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-on-background">Last comparison</p>
                <form action={deleteAnalysisComparisonAction}>
                  <input type="hidden" name="id" value={comparisonResult.id} />
                  <ConfirmDeleteButton confirmMessage="Delete this comparison permanently?" />
                </form>
              </div>
              <p className="mt-2 text-xs text-secondary">
                {comparisonResult.left_analysis_id.slice(0, 8)} vs{" "}
                {comparisonResult.right_analysis_id.slice(0, 8)}
              </p>
              <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-surface-container-lowest p-3 text-xs text-secondary">
                {JSON.stringify(comparisonResult.result, null, 2)}
              </pre>
            </div>
          ) : (
            <EmptyState
              title="Pick two analyses"
              description="Compare hooks, structure, rehooks, and scorecards without implying views equal quality."
            />
          )}
        </div>
      ) : null}

      {tab === "saved" ? (
        <div className="mb-6 space-y-3">
          <h2 className="font-headline text-lg font-semibold text-on-background">
            Saved patterns
          </h2>
          {(savedPatterns?.length ?? 0) === 0 ? (
            <p className="text-sm text-secondary">
              No reusable patterns saved yet. Save one from an analysis detail page.
            </p>
          ) : (
            <ul className="space-y-2">
              {savedPatterns?.map((pattern) => (
                <li
                  key={pattern.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/20 bg-surface-primary px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-on-background">
                      {pattern.name}
                    </p>
                    <p className="text-xs text-secondary">
                      {pattern.pattern_type}
                      {pattern.source_analysis_id
                        ? ` · from ${pattern.source_analysis_id.slice(0, 8)}`
                        : ""}
                    </p>
                  </div>
                  <form action={deleteSavedPatternAction}>
                    <input type="hidden" name="id" value={pattern.id} />
                    <ConfirmDeleteButton confirmMessage="Delete this saved pattern permanently?" />
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab !== "new" && tab !== "compare" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary">{tab}</Badge>
            <Badge variant="default">{analyses?.length ?? 0} total</Badge>
          </div>
          {(analyses?.length ?? 0) > 0 ? (
            <AnalysisList analyses={analyses ?? []} filter={tab} />
          ) : (
            <EmptyState
              title="Empty library"
              description="Run a new analysis to populate this filter."
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
