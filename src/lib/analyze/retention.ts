import type { AnalysisResult } from "./schema";

export type RetentionPointInput = {
  elapsedSeconds: number;
  positionRatio: number;
  audienceWatchRatio: number;
};

function median3(left: number, center: number, right: number): number {
  return [left, center, right].sort((a, b) => a - b)[1]!;
}

export function parseRetentionCurve(
  raw: string,
  durationSeconds: number,
): RetentionPointInput[] {
  const pairs = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const values = line
        .split(/[,;\t\s]+/)
        .map(Number)
        .filter((value) => Number.isFinite(value));
      return values.length >= 2 ? [[values[0]!, values[1]!] as const] : [];
    });
  if (pairs.length < 3) {
    throw new Error("Paste at least three time,retention points.");
  }
  if (pairs.length > 500) {
    throw new Error("Retention curves are limited to 500 points.");
  }

  const timeIsRatio = pairs.every(([time]) => time >= 0 && time <= 1);
  const points = pairs.map(([time, retention]) => {
    const elapsedSeconds = timeIsRatio ? time * durationSeconds : time;
    const audienceWatchRatio = retention > 3 ? retention / 100 : retention;
    if (elapsedSeconds < 0 || elapsedSeconds > durationSeconds * 1.01) {
      throw new Error(`Time ${time} is outside this video's duration.`);
    }
    if (audienceWatchRatio < 0 || audienceWatchRatio > 5) {
      throw new Error(`Retention value ${retention} is outside the supported range.`);
    }
    return {
      elapsedSeconds,
      positionRatio: Math.min(1, elapsedSeconds / Math.max(1, durationSeconds)),
      audienceWatchRatio,
    };
  });

  return points.sort((left, right) => left.elapsedSeconds - right.elapsedSeconds);
}

export function detectObservedRetentionChanges(
  points: RetentionPointInput[],
): AnalysisResult["observedRetention"] {
  if (points.length < 3) return [];
  const smoothed = points.map((point, index) => ({
    ...point,
    smoothed:
      index === 0 || index === points.length - 1
        ? point.audienceWatchRatio
        : median3(
            points[index - 1]!.audienceWatchRatio,
            point.audienceWatchRatio,
            points[index + 1]!.audienceWatchRatio,
          ),
  }));

  const changes: AnalysisResult["observedRetention"] = [];
  for (let index = 2; index < smoothed.length; index += 1) {
    const earlier = smoothed[index - 2]!;
    const current = smoothed[index]!;
    const drop = earlier.smoothed - current.smoothed;
    const next = smoothed[index + 1];
    const persists = !next || next.smoothed <= current.smoothed + 0.02;
    if (drop >= 0.05 && persists) {
      const prior = changes.at(-1);
      if (prior && current.elapsedSeconds - prior.endSeconds <= 2) {
        prior.endSeconds = current.elapsedSeconds;
        prior.note = `Observed retention decline of at least ${Math.round(drop * 100)} percentage points across this interval.`;
      } else {
        changes.push({
          startSeconds: earlier.elapsedSeconds,
          endSeconds: current.elapsedSeconds,
          note: `Observed retention decline of ${Math.round(drop * 100)} percentage points.`,
        });
      }
    }
  }
  return changes.slice(0, 20);
}

