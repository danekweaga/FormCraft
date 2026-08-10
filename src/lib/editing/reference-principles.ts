import { normalizeAnalysisResult, type AnalysisResult } from "@/lib/analyze/schema";

/**
 * Extract abstract editing principles from an analysis — never copy timestamps.
 */
export function extractReferencePrinciples(
  analysisResult: unknown,
): string[] {
  const result = normalizeAnalysisResult(analysisResult);
  return principlesFromAnalysis(result);
}

function principlesFromAnalysis(result: AnalysisResult): string[] {
  const out: string[] = [];

  if (result.visualObservations.length === 0 && result.editingMap.length === 0) {
    out.push(
      "Reference has no visual/editing evidence — principles are structural/script-only.",
    );
  } else {
    out.push(
      "Reference includes some visual observations — treat as inspiration, not a cut recipe.",
    );
  }

  if (result.hooks[0]?.mechanisms.includes("Curiosity")) {
    out.push("Opening leans on curiosity / unanswered tension.");
  }
  if (result.rehooks.length >= 2) {
    out.push("Multiple verbal rehooks renew attention mid-piece.");
  } else if (result.rehooks.length === 0) {
    out.push("Relatively few verbal rehooks — continuity may be intentional.");
  }

  const proofHeavy = result.claims.filter((c) => c.evidenceProvided.length > 0)
    .length;
  if (proofHeavy >= 2) {
    out.push("Claims often paired with in-content proof language or examples.");
  }

  if (
    result.retentionRisks.some((r) =>
      (r.reason || "").toLowerCase().includes("dense"),
    )
  ) {
    out.push(
      "Dense explanatory stretches appear — reference may tolerate calm talking-head or may need resets depending on direction.",
    );
  }

  if (result.improvedStructure.length > 0) {
    out.push(
      `Structure shape leans: ${result.improvedStructure
        .slice(0, 4)
        .map((s) => s.section)
        .join(" → ")}.`,
    );
  }

  out.push("Do not clone exact cut timings from the reference.");
  return out;
}
