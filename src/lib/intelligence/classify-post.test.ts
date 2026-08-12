import { describe, expect, it } from "vitest";
import { classifyPostHeuristic } from "./classify-post";

function classify(input: { caption?: string; transcript?: string }) {
  return classifyPostHeuristic({
    title: null,
    caption: input.caption ?? null,
    transcript: input.transcript ?? null,
    format: "reel",
    durationSeconds: 45,
  });
}

describe("local post topic classification", () => {
  it("classifies existing captions without a transcript API", () => {
    expect(
      classify({ caption: "How did you know I'm a vibe coder? #vibecoding #csstudents" })
        .topic,
    ).toBe("AI-assisted coding");
    expect(
      classify({ caption: "I am still working on LeetCode number one" }).topic,
    ).toBe("LeetCode & interview prep");
    expect(
      classify({ caption: ".env is where developers keep secret credentials" })
        .topic,
    ).toBe("Developer security & secrets");
  });

  it("uses a pasted transcript as stronger stored evidence", () => {
    const result = classify({
      caption: "New post #computerscience",
      transcript:
        "One broken tutorial made me stop coding. Here is how I escaped tutorial hell.",
    });
    expect(result.topic).toBe("Tutorial dependency & self-learning");
    expect(result.confidence).toBeGreaterThanOrEqual(0.58);
  });

  it("uses a meaningful niche hashtag when no taxonomy rule matches", () => {
    expect(classify({ caption: "A new lesson #buildinpublic" }).topic).toBe(
      "Buildinpublic",
    );
  });
});
