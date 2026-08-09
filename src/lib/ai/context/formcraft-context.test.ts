import { describe, expect, it } from "vitest";
import { estimateTokens } from "@/lib/ai/models/estimate-tokens";
import { CONTEXT_BUDGETS } from "@/lib/ai/models/types";
import { detectDuplicateIdea } from "@/lib/growth/idea-gate-intelligence";
import { scoreText, trimToBudget } from "./formcraft-context";

describe("context budgeting helpers", () => {
  it("keeps cheap budget smaller than premium and includes multimodal", () => {
    expect(CONTEXT_BUDGETS.cheap).toBeLessThan(CONTEXT_BUDGETS.standard);
    expect(CONTEXT_BUDGETS.standard).toBeLessThan(CONTEXT_BUDGETS.premium);
    expect(CONTEXT_BUDGETS.multimodal).toBeGreaterThan(CONTEXT_BUDGETS.cheap);
  });

  it("estimates tokens deterministically", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(40))).toBe(10);
  });
});

describe("context ranking / trimming", () => {
  it("scores query overlap", () => {
    expect(scoreText("aws internship story", "My AWS internship story")).toBeGreaterThan(
      scoreText("aws internship story", "unrelated gardening tips"),
    );
  });

  it("trims lower-priority items when over budget", () => {
    const items = [
      {
        sourceType: "my_content" as const,
        sourceId: "1",
        title: "A",
        excerpt: "a",
        relevanceScore: 0.9,
        content: "x".repeat(400),
        priority: 100,
      },
      {
        sourceType: "knowledge_document" as const,
        sourceId: "2",
        title: "B",
        excerpt: "b",
        relevanceScore: 0.5,
        content: "y".repeat(400),
        priority: 40,
      },
      {
        sourceType: "draft_or_idea" as const,
        sourceId: "3",
        title: "C",
        excerpt: "c",
        relevanceScore: 0.2,
        content: "z".repeat(400),
        priority: 10,
      },
    ];
    const tinyBudget = estimateTokens(`A\n${"x".repeat(400)}`) + 5;
    const { kept, excluded } = trimToBudget(items, tinyBudget);
    expect(kept.length).toBeGreaterThanOrEqual(1);
    expect(kept[0]?.title).toBe("A");
    expect(excluded.length).toBeGreaterThan(0);
  });
});

describe("duplicate idea helper", () => {
  it("flags high overlap", () => {
    const result = detectDuplicateIdea(
      "AI is making CS students worse at coding interviews",
      [
        "AI Is Making CS Students Worse",
        "How to build a portfolio that stands out",
      ],
    );
    expect(result.risk === "high" || result.risk === "medium").toBe(true);
  });

  it("allows distinct angles", () => {
    const result = detectDuplicateIdea(
      "The specific debugging skill that becomes more valuable when AI writes code",
      ["Stop letting ChatGPT write everything"],
    );
    expect(result.risk).toBe("low");
  });
});
