export function isReconnectRequiredError(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    text.includes("session has been invalidated") ||
    text.includes("error validating access token") ||
    text.includes("user changed their password") ||
    text.includes("changed the session for security") ||
    /oauth.?exception/.test(text) ||
    /invalid.?oauth/.test(text) ||
    (text.includes("access token") &&
      (text.includes("invalid") ||
        text.includes("expired") ||
        text.includes("cannot be decrypted"))) ||
    /token (has )?expired/.test(text) ||
    text.includes("please log in again") ||
    text.includes("reconnect this account")
  );
}

export function reconnectRequiredCopy(platform: string): string {
  const name = platform.replace(/_/g, " ");
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  if (platform === "instagram") {
    return "Instagram signed you out after a password change or a Facebook security reset. Refresh cannot fix a dead token — reconnect once, then posts and followers sync again. Until then, add posts manually.";
  }
  return `${capitalized} signed you out. Reconnect the account to keep syncing. Refresh will keep failing until you do. Until then, add posts manually.`;
}
