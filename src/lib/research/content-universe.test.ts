import { describe, expect, it } from "vitest";
import { classifyCreatorContentUniverse } from "./content-universe";

function classify(title: string, description = "") {
  return classifyCreatorContentUniverse({ title, description, creatorName: null });
}

describe("classifyCreatorContentUniverse", () => {
  it.each([
    "Things nobody warned me about before studying computer science",
    "Why debugging matters more than learning another framework",
    "I built an app in one day and deployment broke it",
    "Does AI make beginner programmers worse at coding?",
    "AWS almost cooked me with this cloud bill",
    "What I learned after 100 internship applications",
    "We built the wrong MVP at a hackathon",
    "The best laptop specs for a CS student",
    "How I escaped tutorial hell as a self taught developer",
    "My content analytics workflow as a tech creator",
    "WELCOME TO THE LOOP #computerscience #softwareengineer #leetcode",
  ])("keeps an allowed video: %s", (title) => {
    expect(classify(title).relevant).toBe(true);
  });

  it.each([
    "My everyday skincare routine",
    "Premier league football highlights",
    "Easy pasta recipe in ten minutes",
    "Celebrity relationship drama explained",
    "Five exercises for bigger shoulders",
    "Admissions Open 2026 | Shape Your Future",
    "11th Chemistry Quarterly Exam Questions",
    "Unstop App Kya Hai? Best Platform for Internships, Jobs & Hackathons",
    "B.Tech CSE Complete Roadmap | Highest Package 25+ LPA",
    "Why IIT toppers are ignoring computer science",
    "KCET 2026 CSE First Round Cutoff",
    "कोडिंग कैसे शुरू करें?",
    "AI fruit cutting ASMR",
    "Veo 3 watermelon satisfying",
    "Sora AI generated fruit compilation",
    "Hyperrealistic AI food ASMR",
    "Grok imagine making fruit",
    "GPT fruit cutting",
    "AI satisfying watermelon",
  ])("drops an unrelated video: %s", (title) => {
    expect(classify(title).relevant).toBe(false);
  });

  it("labels AI fruit and generative entertainment as slop", () => {
    const result = classify("AI fruit cutting satisfying");
    expect(result.relevant).toBe(false);
    expect(result.reason).toMatch(/ai entertainment slop/i);
  });

  it("keeps North American and UK placement content", () => {
    expect(
      classify(
        "MSc Artificial Intelligence student shares her industry placement experience",
      ).relevant,
    ).toBe(true);
  });

  it("does not accept an unrelated title because its description mentions LinkedIn", () => {
    const result = classifyCreatorContentUniverse({
      title: "A qualification gives you more than a certificate",
      description: "Follow our university on LinkedIn and enroll today.",
      creatorName: "Generic Learning",
    });
    expect(result.relevant).toBe(false);
  });

  it("accepts a specific topic saved in the niche profile", () => {
    const result = classifyCreatorContentUniverse(
      { title: "What Dalhousie co-op changed for me", description: null, creatorName: null },
      "",
      { topics: ["Dalhousie co-op"] },
    );
    expect(result.relevant).toBe(true);
    expect(result.category).toBe("Saved niche topic");
  });

  it("does not admit an unrelated viral post just because it has views", () => {
    const result = classifyCreatorContentUniverse(
      { title: "The dance challenge everyone is copying", description: null, creatorName: null },
      "student developer technology",
    );
    expect(result.relevant).toBe(false);
  });
});
