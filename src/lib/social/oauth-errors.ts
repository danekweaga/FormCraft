const FRIENDLY: Array<{ match: RegExp; message: string }> = [
  {
    match: /redirect.?uri|can't load url|cannot load url|url blocked|domain/i,
    message:
      "Instagram rejected the callback URL. In Meta → Instagram → Business login settings, the OAuth redirect URI must be exactly https://form-craft-phi.vercel.app/api/social/instagram/callback (no trailing slash).",
  },
  {
    match: /access_denied|user_denied|permissions error/i,
    message:
      "Instagram login was cancelled or the account is not allowed. If the app is in Development, add this Instagram account as an Instagram Tester first.",
  },
  {
    match: /invalid.?scope|permission.*not.*granted|unknown permission/i,
    message:
      "FormCraft asked for a permission this Meta app does not have. Add instagram_business_manage_insights under Instagram → Permissions and features, then Reconnect again.",
  },
  {
    match: /not configured|META_APP_ID/i,
    message:
      "Instagram is not configured in Vercel. META_APP_ID must be the Instagram app ID from this page (not the Facebook app ID), and META_APP_SECRET must be the Instagram app secret.",
  },
  {
    match: /invalid oauth state|oauth state expired|state/i,
    message:
      "The login session expired before Instagram sent you back. Click Reconnect again and finish the Meta screens in one go.",
  },
  {
    match: /session has been invalidated|error validating access token|changed their password/i,
    message:
      "Facebook still rejected the old session. Reconnect must complete a new Instagram login. If Meta skips the login screen, sign out of Instagram in that browser and try again.",
  },
];

export function friendlyOAuthError(raw: string | null | undefined): string {
  const text = raw?.trim();
  if (!text) return "Instagram login failed. Try Reconnect again.";
  for (const entry of FRIENDLY) {
    if (entry.match.test(text)) return entry.message;
  }
  return text;
}

export function oauthProviderError(url: URL): string | null {
  const error = url.searchParams.get("error");
  if (!error) return null;
  const description =
    url.searchParams.get("error_description") ??
    url.searchParams.get("error_reason") ??
    error;
  return friendlyOAuthError(description);
}
