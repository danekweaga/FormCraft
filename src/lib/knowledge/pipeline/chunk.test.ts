import { describe, expect, it } from "vitest";
import { chunkText, estimateTokenCount } from "./chunk";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const chunks = chunkText("Short note");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.chunkIndex).toBe(0);
    expect(chunks[0]?.tokenCount).toBe(estimateTokenCount("Short note"));
  });

  it("splits long text into multiple overlapping chunks", () => {
    const text = Array.from({ length: 80 }, (_, i) => `Sentence number ${i}.`).join(" ");
    const chunks = chunkText(text, { maxChars: 120, overlapChars: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.content.length > 0)).toBe(true);
  });
});
