import { describe, expect, it } from "vitest";
import { decideAuthRedirect } from "./route-guards";

describe("decideAuthRedirect", () => {
  it("sends anonymous users on protected routes to sign-in", () => {
    expect(decideAuthRedirect("/knowledge", false)).toEqual({
      type: "redirect",
      to: "/sign-in?next=%2Fknowledge",
    });
  });

  it("sends authenticated users away from auth pages", () => {
    expect(decideAuthRedirect("/sign-in", true)).toEqual({
      type: "redirect",
      to: "/today",
    });
  });

  it("allows authenticated access to My Content and Analyze", () => {
    expect(decideAuthRedirect("/my-content", true)).toEqual({ type: "none" });
    expect(decideAuthRedirect("/analyze", true)).toEqual({ type: "none" });
  });

  it("protects creator growth routes for anonymous users", () => {
    expect(decideAuthRedirect("/roadmap", false)).toEqual({
      type: "redirect",
      to: "/sign-in?next=%2Froadmap",
    });
    expect(decideAuthRedirect("/experiments", false).type).toBe("redirect");
    expect(decideAuthRedirect("/audience", false).type).toBe("redirect");
    expect(decideAuthRedirect("/pre-publish", false).type).toBe("redirect");
    expect(decideAuthRedirect("/idea-gate", false).type).toBe("redirect");
  });

  it("allows authenticated access to creator growth routes", () => {
    expect(decideAuthRedirect("/roadmap", true)).toEqual({ type: "none" });
    expect(decideAuthRedirect("/idea-gate", true)).toEqual({ type: "none" });
  });
});
