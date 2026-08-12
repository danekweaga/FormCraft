import { describe, expect, it } from "vitest";
import { auditCreatorProfile, buildSuggestedBio } from "./profile-audit";

describe("creator profile audit", () => {
  it("detects aligned recent content and pillar coverage", () => {
    const result = auditCreatorProfile({
      whatIMake: "Practical computer science content for students",
      audience: "Computer science students building careers",
      socialBio: "CS projects and AI for students ↓",
      contentPillars: ["portfolio projects", "AI tools", "internships"],
      posts: [
        "AI tools for a portfolio project",
        "My software portfolio",
        "Internship resume lesson",
        "Building a student app",
        "AI coding workflow",
      ].map((title) => ({
        title,
        caption: null,
        topic: title,
        contentPillar: null,
      })),
    });
    expect(result.status).toBe("on_strategy");
    expect(result.alignmentPercent).toBe(100);
    expect(result.pillarCoverage.every((pillar) => pillar.covered)).toBe(true);
  });

  it("flags repeated off-strategy themes without claiming causation", () => {
    const result = auditCreatorProfile({
      whatIMake: "Coding advice for computer science students",
      audience: "Computer science students",
      socialBio: "Daily life",
      contentPillars: ["coding", "internships"],
      posts: Array.from({ length: 6 }, (_, index) => ({
        title: `Gym routine ${index}`,
        caption: "Fitness workout",
        topic: "fitness",
        contentPillar: "fitness",
      })),
    });
    expect(result.status).toBe("drifting");
    expect(result.offStrategyThemes[0]?.name).toBe("fitness");
    expect(result.recommendations.join(" ")).toContain("deliberate new pillar");
  });

  it("keeps suggested Instagram bio copy within 150 characters", () => {
    const bio = buildSuggestedBio({
      whatIMake: "Practical lessons about software projects and developer careers",
      audience: "ambitious computer science students",
      pillars: ["Projects", "AI", "Career"],
    });
    expect(bio).not.toBeNull();
    expect(bio!.length).toBeLessThanOrEqual(150);
  });
});

