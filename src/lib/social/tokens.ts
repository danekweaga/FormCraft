import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTokenEncryptionKey } from "./config";
import type { TokenBundle } from "./types";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const secret = getTokenEncryptionKey();
  if (!secret) {
    throw new Error(
      "SOCIAL_TOKEN_ENCRYPTION_KEY is required to store OAuth credentials",
    );
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const secret = getTokenEncryptionKey();
  if (!secret) {
    throw new Error(
      "SOCIAL_TOKEN_ENCRYPTION_KEY is required to read OAuth credentials",
    );
  }
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted token payload");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(secret),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export async function storeCredentials(params: {
  connectionId: string;
  userId: string;
  tokens: TokenBundle;
}) {
  const admin = createAdminClient();
  const access = encryptSecret(params.tokens.accessToken);
  const refresh = params.tokens.refreshToken
    ? encryptSecret(params.tokens.refreshToken)
    : null;

  const { error } = await admin.from("social_oauth_credentials").upsert(
    {
      connection_id: params.connectionId,
      user_id: params.userId,
      access_token_encrypted: access,
      refresh_token_encrypted: refresh,
      token_expires_at: params.tokens.expiresAt ?? null,
      provider_token_metadata: {
        // Never store raw tokens here — scopes/metadata only
        scopes: params.tokens.scopes,
        ...(params.tokens.metadata ?? {}),
      },
    },
    { onConflict: "connection_id" },
  );

  if (error) throw new Error(error.message);
}

export async function loadCredentials(
  connectionId: string,
  userId: string,
): Promise<TokenBundle | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("social_oauth_credentials")
    .select(
      "access_token_encrypted, refresh_token_encrypted, token_expires_at, provider_token_metadata, user_id",
    )
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.user_id !== userId) return null;

  const meta = (data.provider_token_metadata ?? {}) as Record<string, unknown>;
  const scopes = Array.isArray(meta.scopes)
    ? meta.scopes.filter((s): s is string => typeof s === "string")
    : [];

  return {
    accessToken: decryptSecret(data.access_token_encrypted),
    refreshToken: data.refresh_token_encrypted
      ? decryptSecret(data.refresh_token_encrypted)
      : null,
    expiresAt: data.token_expires_at,
    scopes,
    metadata: meta,
  };
}

export async function deleteCredentials(connectionId: string, userId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("social_oauth_credentials")
    .delete()
    .eq("connection_id", connectionId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Strip anything that looks like a bearer token before logging/prompting. */
export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length > 40 && /^[A-Za-z0-9._\-~]+$/.test(value)) {
      return "[redacted]";
    }
    return value.replace(
      /(access_token|refresh_token|bearer)\s*[=:]\s*\S+/gi,
      "$1=[redacted]",
    );
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (/token|secret|authorization|password/i.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  return value;
}
