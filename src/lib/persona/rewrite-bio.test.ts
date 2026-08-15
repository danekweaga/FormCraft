import { describe, expect, it } from "vitest";
import {
  countPostThemes,
  heuristicBioRewrite,
  postsWithUsableText,
} from "./rewrite-bio";

describe("rewrite-bio heuristics", () => {
  it("counts themes from owned posts", () => {
    const themes = countPostThemes([
      { title: "A", caption: "x", topic: "AI tools", contentPillar: null },
      { title: "B", caption: "y", topic: "AI tools", contentPillar: null },
      { title: "C", caption: "z", topic: null, contentPillar: "Internships" },
    ]);
    expect(themes[0]).toEqual({ name: "AI tools", posts: 2 });
  });

  it("requires enough text before rewriting", () => {
    expect(
      postsWithUsableText([
        { title: null, caption: null, topic: null, contentPillar: null },
        { title: "Real post about CS", caption: "x", topic: null, contentPillar: null },
      ]),
    ).toHaveLength(1);
  });

  it("builds fallback variants from post themes", () => {
    const result = heuristicBioRewrite({
      whatIMake: "I make practical CS and AI content for students building portfolios.",
      audience: "CS students who want internships and real projects",
      pillars: ["Portfolio projects", "AI for students"],
      currentBio: "",
      posts: [
        {
          title: "Portfolio tip",
          caption: "Ship one project",
          topic: "Portfolio projects",
          contentPillar: "Portfolio projects",
        },
        {
          title: "AI workflow",
          caption: "Use models carefully",
          topic: "AI for students",
          contentPillar: "AI for students",
        },
        {
          title: "Internship notes",
          caption: "What recruiters asked",
          topic: "Internships",
          contentPillar: "Internships",
        },
      ],
    });
    expect(result.variants.length).toBeGreaterThan(0);
    expect(result.variants[0]!.bio.length).toBeLessThanOrEqual(150);
    expect(result.observedThemes).toContain("Portfolio projects");
  });
});
