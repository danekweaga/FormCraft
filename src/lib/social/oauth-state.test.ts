import { describe, expect, it } from "vitest";
import { createOAuthState, createPkcePair, parseOAuthState } from "./oauth-state";

describe("oauth state", () => {
  it("round-trips signed state with PKCE verifier", () => {
    process.env.SOCIAL_OAUTH_STATE_SECRET = "test-secret-for-oauth-state";
    const { codeVerifier } = createPkcePair();
    const state = createOAuthState({
      userId: "11111111-1111-1111-1111-111111111111",
      platform: "tiktok",
      codeVerifier,
    });
    const parsed = parseOAuthState(state, "tiktok");
    expect(parsed.userId).toBe("11111111-1111-1111-1111-111111111111");
    expect(parsed.codeVerifier).toBe(codeVerifier);
  });

  it("rejects platform mismatch", () => {
    process.env.SOCIAL_OAUTH_STATE_SECRET = "test-secret-for-oauth-state";
    const state = createOAuthState({
      userId: "11111111-1111-1111-1111-111111111111",
      platform: "instagram",
    });
    expect(() => parseOAuthState(state, "youtube")).toThrow(/platform mismatch/i);
  });
});
