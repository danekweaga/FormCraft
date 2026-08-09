export type TextChunk = {
  chunkIndex: number;
  content: string;
  tokenCount: number;
};

/** Approximate token count (~4 chars/token). */
export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Split text into overlapping chunks for retrieval.
 * Does not require embeddings to be useful.
 */
export function chunkText(
  text: string,
  options?: { maxChars?: number; overlapChars?: number },
): TextChunk[] {
  const maxChars = options?.maxChars ?? 1200;
  const overlapChars = options?.overlapChars ?? 150;
  const cleaned = text.trim();
  if (!cleaned) return [];

  if (cleaned.length <= maxChars) {
    return [
      {
        chunkIndex: 0,
        content: cleaned,
        tokenCount: estimateTokenCount(cleaned),
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + maxChars, cleaned.length);
    if (end < cleaned.length) {
      const slice = cleaned.slice(start, end);
      const breakAt = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf(" "),
      );
      if (breakAt > maxChars * 0.4) {
        end = start + breakAt + 1;
      }
    }

    const content = cleaned.slice(start, end).trim();
    if (content) {
      chunks.push({
        chunkIndex: index,
        content,
        tokenCount: estimateTokenCount(content),
      });
      index += 1;
    }

    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlapChars);
  }

  return chunks;
}
