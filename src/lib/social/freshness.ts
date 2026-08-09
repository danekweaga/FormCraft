export type FreshnessState =
  | { kind: "fresh"; label: string }
  | { kind: "stale"; label: string }
  | { kind: "sync_required"; label: string }
  | { kind: "disconnected"; label: string }
  | { kind: "partial"; label: string }
  | { kind: "unknown"; label: string };

export function formatRelativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const deltaMs = Date.now() - then;
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** Read synced follower count from connection metadata — never invent a value. */
export function connectionFollowerCount(
  metadata: Record<string, unknown> | null | undefined,
): number | null {
  if (!metadata) return null;

  const top = metadata.follower_count;
  if (typeof top === "number" && Number.isFinite(top)) return top;

  const profile = metadata.profile;
  if (profile && typeof profile === "object") {
    const record = profile as Record<string, unknown>;
    const nested = record.followerCount ?? record.follower_count;
    if (typeof nested === "number" && Number.isFinite(nested)) return nested;
  }

  return null;
}

export function formatFollowerCount(count: number | null): string {
  if (count === null) return "Unavailable";
  return count.toLocaleString();
}

export function connectionFreshness(params: {
  status: string;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  staleAfterHours?: number;
}): FreshnessState {
  if (params.status === "disconnected") {
    return { kind: "disconnected", label: "Account disconnected" };
  }
  if (params.status === "needs_attention" || params.lastError) {
    return {
      kind: "sync_required",
      label: params.lastError
        ? `Sync required — ${params.lastError}`
        : "Sync required",
    };
  }
  if (params.status === "syncing") {
    return { kind: "partial", label: "Syncing" };
  }
  const relative = formatRelativeTime(params.lastSuccessfulSyncAt);
  if (!relative || !params.lastSuccessfulSyncAt) {
    return { kind: "sync_required", label: "Sync required" };
  }
  const ageHours =
    (Date.now() - new Date(params.lastSuccessfulSyncAt).getTime()) / 3_600_000;
  const staleAfter = params.staleAfterHours ?? 48;
  if (ageHours > staleAfter) {
    return { kind: "stale", label: `Updated ${relative}` };
  }
  return { kind: "fresh", label: `Updated ${relative}` };
}

export function sourceLabelForSynced(platform: string, syncedAt: string | null) {
  const relative = formatRelativeTime(syncedAt);
  const name = platform.replace(/_/g, " ");
  if (!relative) return `${name} · Synced`;
  return `${name} · Synced ${relative}`;
}

/** Metadata AI context builders should attach — never include tokens. */
export function freshnessMetadataForAi(params: {
  lastSuccessfulSyncAt: string | null;
  metricsRefreshedAt: string | null;
  connectionStatus: string | null;
}) {
  return {
    data_freshness: {
      connection_status: params.connectionStatus,
      last_successful_sync_at: params.lastSuccessfulSyncAt,
      metrics_refreshed_at: params.metricsRefreshedAt,
      label: connectionFreshness({
        status: params.connectionStatus ?? "unknown",
        lastSuccessfulSyncAt: params.lastSuccessfulSyncAt,
        lastError: null,
      }).label,
      stale:
        connectionFreshness({
          status: params.connectionStatus ?? "unknown",
          lastSuccessfulSyncAt:
            params.metricsRefreshedAt ?? params.lastSuccessfulSyncAt,
          lastError: null,
        }).kind !== "fresh",
    },
  };
}
