import { createAdminClient } from "@/lib/supabase/admin";
import { storeCredentials } from "./tokens";
import type { ConnectionResult, OwnedPlatform } from "./types";
import { runSocialSync } from "./sync/run-sync";

export async function completeOwnedConnection(params: {
  userId: string;
  platform: OwnedPlatform;
  result: ConnectionResult;
}) {
  const admin = createAdminClient();
  const { profile, tokens } = params.result;

  const { data: existing } = await admin
    .from("social_connections")
    .select("id")
    .eq("user_id", params.userId)
    .eq("platform", params.platform)
    .eq("platform_account_id", profile.platformAccountId)
    .maybeSingle();

  const row = {
    user_id: params.userId,
    platform: params.platform,
    platform_account_id: profile.platformAccountId,
    username: profile.username,
    display_name: profile.displayName,
    avatar_url: profile.avatarUrl,
    account_type: "owned" as const,
    status: "connected" as const,
    granted_scopes: tokens.scopes,
    access_token_reference: "social_oauth_credentials",
    refresh_token_reference: tokens.refreshToken
      ? "social_oauth_credentials"
      : null,
    token_expires_at: tokens.expiresAt ?? null,
    last_error: null,
    metadata: {
      profile: profile.metadata ?? {},
      follower_count: profile.followerCount,
    },
  };

  let connectionId: string;
  if (existing?.id) {
    const { data, error } = await admin
      .from("social_connections")
      .update(row)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to update connection");
    connectionId = data.id;
  } else {
    const { data, error } = await admin
      .from("social_connections")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create connection");
    connectionId = data.id;
  }

  await storeCredentials({
    connectionId,
    userId: params.userId,
    tokens,
  });

  // Point token references at the credential row id (connection id)
  await admin
    .from("social_connections")
    .update({
      access_token_reference: connectionId,
      refresh_token_reference: tokens.refreshToken ? connectionId : null,
    })
    .eq("id", connectionId);

  const { jobId } = await runSocialSync({
    userId: params.userId,
    connectionId,
    syncType: "initial_import",
  });

  return { connectionId, jobId };
}
