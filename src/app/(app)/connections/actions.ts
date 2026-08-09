"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { disconnectSocialAccount } from "@/lib/social/disconnect";
import { getOwnedProvider, isOwnedPlatform } from "@/lib/social/providers";
import { runSocialSync } from "@/lib/social/sync/run-sync";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  return { supabase, user };
}

function revalidateAfterSync() {
  revalidatePath("/connections");
  revalidatePath("/my-content");
  revalidatePath("/performance");
  revalidatePath("/today");
  revalidatePath("/experiments");
  revalidatePath("/roadmap");
  revalidatePath("/audience");
}

export type ConnectionActionState = {
  error?: string;
  success?: string;
};

export async function syncConnectionNow(
  _prev: ConnectionActionState,
  formData: FormData,
): Promise<ConnectionActionState> {
  try {
    const connectionId = z.string().uuid().parse(formData.get("connectionId"));
    const { supabase, user } = await requireUser();

    const { data: connection, error } = await supabase
      .from("social_connections")
      .select("id, platform, status, account_type")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return { error: error.message };
    if (!connection) return { error: "Connection not found." };
    if (connection.account_type !== "owned") {
      return { error: "Only owned accounts can refresh into My Content." };
    }
    if (connection.status === "disconnected") {
      return { error: "Reconnect this account before refreshing." };
    }
    if (!isOwnedPlatform(connection.platform)) {
      return { error: "Platform adapter unavailable." };
    }
    if (!getOwnedProvider(connection.platform).isConfigured()) {
      return {
        error:
          getOwnedProvider(connection.platform).unconfiguredReason() ??
          "This platform is not configured.",
      };
    }

    await runSocialSync({
      userId: user.id,
      connectionId,
      syncType: "incremental_sync",
    });
    revalidateAfterSync();
    return {
      success: "Posts and follower metrics refreshed from the connected account.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Refresh failed.",
    };
  }
}

export async function refreshAllConnectedAccounts(
  _prev: ConnectionActionState,
  _formData: FormData,
): Promise<ConnectionActionState> {
  try {
    const { supabase, user } = await requireUser();
    const { data: connections, error } = await supabase
      .from("social_connections")
      .select("id, platform, status")
      .eq("user_id", user.id)
      .eq("account_type", "owned")
      .in("status", ["connected", "needs_attention", "syncing"]);

    if (error) return { error: error.message };

    const refreshable = (connections ?? []).filter((connection) => {
      if (!isOwnedPlatform(connection.platform)) return false;
      return getOwnedProvider(connection.platform).isConfigured();
    });

    if (refreshable.length === 0) {
      return {
        error:
          "No configured connected accounts to refresh. Connect Instagram, YouTube, or TikTok first.",
      };
    }

    const failures: string[] = [];
    let refreshed = 0;

    for (const connection of refreshable) {
      try {
        await runSocialSync({
          userId: user.id,
          connectionId: connection.id,
          syncType: "incremental_sync",
        });
        refreshed += 1;
      } catch (syncError) {
        failures.push(
          `${connection.platform}: ${
            syncError instanceof Error ? syncError.message : "refresh failed"
          }`,
        );
      }
    }

    revalidateAfterSync();

    if (refreshed === 0) {
      return { error: failures.join(" · ") || "Refresh failed." };
    }

    if (failures.length > 0) {
      return {
        success: `Refreshed posts & followers for ${refreshed} account(s).`,
        error: `Some accounts failed: ${failures.join(" · ")}`,
      };
    }

    return {
      success: `Refreshed posts & followers for ${refreshed} account(s).`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Refresh failed.",
    };
  }
}

export async function disconnectConnection(
  _prev: ConnectionActionState,
  formData: FormData,
): Promise<ConnectionActionState> {
  try {
    const connectionId = z.string().uuid().parse(formData.get("connectionId"));
    const deleteImported =
      formData.get("deleteImportedData") === "true" ||
      formData.get("deleteImportedData") === "on";
    const { user } = await requireUser();
    const result = await disconnectSocialAccount({
      userId: user.id,
      connectionId,
      deleteImportedData: deleteImported,
    });
    revalidatePath("/connections");
    revalidatePath("/my-content");
    revalidatePath("/today");
    return {
      success: result.keptImportedData
        ? "Disconnected. Imported content was kept."
        : "Disconnected and imported content was removed.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Disconnect failed.",
    };
  }
}

export async function updateConnectionSettings(
  _prev: ConnectionActionState,
  formData: FormData,
): Promise<ConnectionActionState> {
  try {
    const connectionId = z.string().uuid().parse(formData.get("connectionId"));
    const syncFrequencyHours = z.coerce
      .number()
      .int()
      .min(1)
      .max(168)
      .parse(formData.get("syncFrequencyHours") ?? 24);

    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("social_connections")
      .update({
        auto_sync_enabled: formData.get("autoSyncEnabled") === "on",
        sync_frequency_hours: syncFrequencyHours,
        import_comments: formData.get("importComments") === "on",
        import_older_posts: formData.get("importOlderPosts") === "on",
        use_for_ai: formData.get("useForAi") === "on",
        use_for_roadmap: formData.get("useForRoadmap") === "on",
        use_for_experiments: formData.get("useForExperiments") === "on",
        next_scheduled_sync_at:
          formData.get("autoSyncEnabled") === "on"
            ? new Date(
                Date.now() + syncFrequencyHours * 60 * 60 * 1000,
              ).toISOString()
            : null,
      })
      .eq("id", connectionId)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
    revalidatePath("/connections");
    return { success: "Settings saved." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Settings update failed.",
    };
  }
}
