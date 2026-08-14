import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { ensureNicheAutoScan } from "./ensure-niche-auto-scan";
import { runResearchScan } from "./run-scan";
import {
  shouldRefreshOnVisit,
  VISIT_REFRESH_COOLDOWN_MS,
} from "./scan-schedule";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function laterTimestamp(
  left: string | null | undefined,
  right: unknown,
): string | null {
  const rightValue = typeof right === "string" ? right : null;
  const leftTime = left ? new Date(left).getTime() : Number.NaN;
  const rightTime = rightValue ? new Date(rightValue).getTime() : Number.NaN;
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime >= rightTime ? (left ?? null) : rightValue;
  }
  if (Number.isFinite(leftTime)) return left ?? null;
  if (Number.isFinite(rightTime)) return rightValue;
  return null;
}

/**
 * On app open, pull only videos posted since the last niche scan into the
 * research library. Watchlist creators stay on the dedicated monitor so this
 * does not spend a credit per tracked account.
 */
export async function refreshNicheFeedIfStale(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<{ ran: boolean; reason: string }> {
  const auto = await ensureNicheAutoScan(params);
  if (!auto) return { ran: false, reason: "no-niche" };

  const { data: scan } = await params.supabase
    .from("research_scans")
    .select("id, last_run_at, parameters")
    .eq("id", auto.scanId)
    .eq("user_id", params.userId)
    .maybeSingle();

  const parameters = asRecord(scan?.parameters);
  const leftoverWatchlist = asStringArray(parameters.creatorIds).length > 0;
  delete parameters.creatorIds;
  delete parameters.channelHandles;
  const lastMarker = laterTimestamp(
    scan?.last_run_at,
    parameters.refresh_claimed_at,
  );
  const needsKick =
    leftoverWatchlist ||
    parameters.force_full_discovery === true ||
    parameters.discoveryMode !== "niche_search";
  if (!needsKick && !shouldRefreshOnVisit(lastMarker)) {
    return { ran: false, reason: "fresh" };
  }

  const claimedAt = new Date().toISOString();
  const cooldownAgo = new Date(Date.now() - VISIT_REFRESH_COOLDOWN_MS).toISOString();
  let claim = params.supabase
    .from("research_scans")
    .update({
      parameters: {
        ...parameters,
        discoveryMode: "niche_search",
        force_full_discovery: needsKick ? true : parameters.force_full_discovery,
        refresh_claimed_at: claimedAt,
      },
    })
    .eq("id", auto.scanId)
    .eq("user_id", params.userId);
  if (!needsKick) {
    claim = claim.or(
      `parameters->>refresh_claimed_at.is.null,parameters->>refresh_claimed_at.lte.${cooldownAgo}`,
    );
  }
  const { data: claimed } = await claim.select("id").maybeSingle();

  if (!claimed) {
    return { ran: false, reason: "claimed" };
  }

  await runResearchScan({
    supabase: params.supabase,
    userId: params.userId,
    scanId: auto.scanId,
  });
  revalidatePath("/research");
  revalidatePath("/today");
  return { ran: true, reason: scan?.last_run_at ? "incremental" : "initial" };
}
