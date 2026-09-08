export type FollowerGoal = {
  target: number;
  current: number | null;
  connectionId: string | null;
  updatedAt: string | null;
};

export function readFollowerGoal(metadata: Record<string, unknown> | null): FollowerGoal | null {
  const raw = metadata?.follower_goal as Partial<FollowerGoal> | undefined;
  if (!raw || !Number.isSafeInteger(raw.target) || Number(raw.target) <= 0) return null;
  return {
    target: Number(raw.target),
    current: typeof raw.current === "number" && Number.isFinite(raw.current) && raw.current >= 0 ? raw.current : null,
    connectionId: typeof raw.connectionId === "string" ? raw.connectionId : null,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export function followerProgress(current: number | null, target: number): number {
  return current == null || target <= 0 ? 0 : Math.min(100, Math.max(0, Math.round(current / target * 100)));
}

export function inferFollowerTarget(goal: string | null | undefined): number | null {
  const text = String(goal ?? "").toLowerCase();
  if (!/followers?|subscribers?/.test(text)) return null;
  const match = text.match(/(?:reach|get to|goal(?: of)?|hit)?\s*([0-9][0-9,.]*)\s*([km])?\s*(?:engaged\s+)?(?:followers?|subscribers?)/i);
  if (!match) return null;
  const base = Number(match[1]!.replaceAll(",", ""));
  const multiplier = match[2]?.toLowerCase() === "k" ? 1_000 : match[2]?.toLowerCase() === "m" ? 1_000_000 : 1;
  const target = Math.round(base * multiplier);
  return Number.isSafeInteger(target) && target > 0 ? target : null;
}

export function followerCheckpoints(target: number): number[] {
  if (!Number.isSafeInteger(target) || target <= 0) return [];
  const steps = [100, 250, 500, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 25000, 50000, 75000, 100000];
  return [...steps.filter((step) => step < target), target];
}

export function checkpointPlan(target: number): string {
  if (target <= 500) return "Publish three CS videos answering one specific student problem. Use the same format and track which brings profile visits or follows when available.";
  if (target <= 1500) return "Turn your strongest CS topic into a three-part series. Keep the audience promise consistent in your bio, first line, and pinned post.";
  if (target <= 3000) return "Test two openings for your strongest topic. Compare results after seven days and keep the format and posting cadence similar.";
  if (target <= 7500) return "Repeat your best series with new examples from your projects. Turn recurring audience questions into follow-ups and compare follows per post where available.";
  return "Build a repeatable weekly series around the topics that bring returning viewers. Review the last ten posts and retire experiments that repeatedly miss your audience.";
}
