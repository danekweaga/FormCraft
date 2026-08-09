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
});
