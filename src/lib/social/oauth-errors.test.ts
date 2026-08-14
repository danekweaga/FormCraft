import { describe, expect, it } from "vitest";
import { friendlyOAuthError, oauthProviderError } from "./oauth-errors";

describe("friendlyOAuthError", () => {
  it("explains a redirect URI mismatch", () => {
    expect(friendlyOAuthError("Can't Load URL")).toMatch(/callback URL/i);
  });

  it("keeps unknown provider text", () => {
    expect(friendlyOAuthError("Something obscure from Meta")).toBe(
      "Something obscure from Meta",
    );
  });
});

describe("oauthProviderError", () => {
  it("prefers error_description from Instagram", () => {
    const url = new URL(
      "https://form-craft-phi.vercel.app/api/social/instagram/callback?error=access_denied&error_reason=user_denied&error_description=Permissions+error",
    );
    expect(oauthProviderError(url)).toMatch(/cancelled|Tester/i);
  });
});
