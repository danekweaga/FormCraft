import { createHmac, randomBytes, createHash } from "crypto";
import type { OwnedPlatform } from "./types";

type OAuthStatePayload = {
  userId: string;
  platform: OwnedPlatform;
  nonce: string;
  exp: number;
  codeVerifier?: string;
};

function signingSecret(): string {
  const secret =
    process.env.SOCIAL_OAUTH_STATE_SECRET ??
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Missing SOCIAL_OAUTH_STATE_SECRET for OAuth state signing");
  }
  return secret;
}

function sign(body: string): string {
  return createHmac("sha256", signingSecret()).update(body).digest("base64url");
}

export function createPkcePair() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function createOAuthState(params: {
  userId: string;
  platform: OwnedPlatform;
  codeVerifier?: string;
}): string {
  const payload: OAuthStatePayload = {
    userId: params.userId,
    platform: params.platform,
    nonce: randomBytes(16).toString("base64url"),
    exp: Date.now() + 15 * 60 * 1000,
    codeVerifier: params.codeVerifier,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function parseOAuthState(
  state: string,
  expectedPlatform: OwnedPlatform,
): OAuthStatePayload {
  const [body, signature] = state.split(".");
  if (!body || !signature || sign(body) !== signature) {
    throw new Error("Invalid OAuth state");
  }
  const payload = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as OAuthStatePayload;
  if (payload.platform !== expectedPlatform) {
    throw new Error("OAuth state platform mismatch");
  }
  if (payload.exp < Date.now()) {
    throw new Error("OAuth state expired");
  }
  if (!payload.userId) {
    throw new Error("OAuth state missing user");
  }
  return payload;
}
