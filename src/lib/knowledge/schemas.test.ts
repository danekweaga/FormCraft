import { describe, expect, it } from "vitest";
import { documentMetadataSchema, noteSchema } from "./schemas";

describe("knowledge schemas", () => {
  it("accepts a valid note", () => {
    const parsed = noteSchema.parse({
      title: "Script rules",
      rawText: "Open with tension.",
      knowledgeType: "instruction",
      importance: "high",
      tags: ["hooks"],
      includeInAi: true,
    });
    expect(parsed.title).toBe("Script rules");
  });

  it("rejects empty titles", () => {
    const result = documentMetadataSchema.safeParse({
      title: " ",
      knowledgeType: "other",
      importance: "normal",
      includeInAi: true,
    });
    expect(result.success).toBe(false);
  });
});
