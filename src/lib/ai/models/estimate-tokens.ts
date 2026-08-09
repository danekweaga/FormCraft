/** Rough token estimate (~4 chars/token). Deterministic; no provider call. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateMessagesTokens(
  messages: Array<{ content: string }>,
): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}
