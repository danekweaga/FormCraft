import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedProvider, isOwnedPlatform } from "./providers";
import { deleteCredentials, loadCredentials } from "./tokens";

export async function disconnectSocialAccount(params: {
  userId: string;
  connectionId: string;
  deleteImportedData: boolean;
}) {
  const admin = createAdminClient();
  const { data: connection, error } = await admin
    .from("social_connections")
    .select("*")
    .eq("id", params.connectionId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error || !connection) {
    throw new Error(error?.message ?? "Connection not found");
  }

  const tokens = await loadCredentials(params.connectionId, params.userId);
  if (tokens && isOwnedPlatform(connection.platform)) {
    const provider = getOwnedProvider(connection.platform);
    try {
      await provider.revokeAuthorization?.(tokens);
    } catch {
      // Revocation best-effort — still invalidate locally
    }
  }

  await deleteCredentials(params.connectionId, params.userId);

  await admin
    .from("social_connections")
    .update({
      status: "disconnected",
      access_token_reference: null,
      refresh_token_reference: null,
      token_expires_at: null,
      next_scheduled_sync_at: null,
      auto_sync_enabled: false,
      last_error: null,
    })
    .eq("id", params.connectionId)
    .eq("user_id", params.userId);

  if (params.deleteImportedData) {
    await admin
      .from("content_posts")
      .delete()
      .eq("user_id", params.userId)
      .eq("social_connection_id", params.connectionId);
  } else {
    await admin
      .from("content_posts")
      .update({ social_connection_id: null })
      .eq("user_id", params.userId)
      .eq("social_connection_id", params.connectionId);
  }

  return {
    keptImportedData: !params.deleteImportedData,
    platform: connection.platform as string,
  };
}
