import { connectionFreshness, formatRelativeTime } from "./freshness";

export type TodaySignal = {
  title: string;
  detail: string;
  href: string;
};

type ConnectionRow = {
  platform: string;
  status: string;
  last_successful_sync_at: string | null;
  last_error: string | null;
  sync_frequency_hours: number | null;
};

type PostRow = {
  id: string;
  title: string | null;
  caption: string | null;
  metrics_refreshed_at: string | null;
  views: number | null;
  platform: string;
};

type ExperimentRow = {
  metrics: unknown;
  status: string;
};

export function buildTodaySignals(params: {
  connections: ConnectionRow[];
  recentSynced: PostRow[];
  experiments: ExperimentRow[];
  hasWeeklyReport: boolean;
  nowMs?: number;
}): TodaySignal[] {
  const now = params.nowMs ?? Date.now();
  const signals: TodaySignal[] = [];

  for (const connection of params.connections) {
    const freshness = connectionFreshness({
      status: connection.status,
      lastSuccessfulSyncAt: connection.last_successful_sync_at,
      lastError: connection.last_error,
      staleAfterHours: (connection.sync_frequency_hours ?? 24) * 2,
    });

    if (
      freshness.kind === "stale" ||
      freshness.kind === "sync_required" ||
      freshness.kind === "disconnected"
    ) {
      const days = connection.last_successful_sync_at
        ? Math.floor(
            (now - new Date(connection.last_successful_sync_at).getTime()) /
              86_400_000,
          )
        : null;
      signals.push({
        title: `${connection.platform} needs attention`,
        detail:
          days !== null && days >= 1
            ? `Your ${connection.platform} hasn't synced in ${days} day${days === 1 ? "" : "s"}.`
            : freshness.label,
        href: "/connections",
      });
    }
  }

  for (const post of params.recentSynced) {
    if (!post.metrics_refreshed_at) continue;
    const ageHours =
      (now - new Date(post.metrics_refreshed_at).getTime()) / 3_600_000;
    if (ageHours <= 36 && (post.views ?? 0) > 0) {
      signals.push({
        title: "Post ready for review",
        detail: `Your latest ${post.platform.replace(/_/g, " ")} now has enough data for review${
          post.title || post.caption
            ? `: “${(post.title || post.caption || "").slice(0, 60)}”`
            : ""
        }.`,
        href: `/my-content/${post.id}`,
      });
      break;
    }
  }

  for (const experiment of params.experiments) {
    const synced = (
      experiment.metrics as {
        synced_from_posts?: { refreshed_at?: string; post_count?: number };
      } | null
    )?.synced_from_posts;
    if (synced?.refreshed_at && (synced.post_count ?? 0) > 0) {
      const relative = formatRelativeTime(synced.refreshed_at);
      signals.push({
        title: "Experiment metrics updated",
        detail: `A running experiment refreshed from connected posts${relative ? ` ${relative}` : ""}.`,
        href: "/experiments",
      });
      break;
    }
  }

  if (params.hasWeeklyReport) {
    signals.push({
      title: "Weekly performance review",
      detail: "Your weekly performance review is ready.",
      href: "/my-content",
    });
  }

  return signals;
}
