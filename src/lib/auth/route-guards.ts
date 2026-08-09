export const AUTH_ROUTES = ["/sign-in", "/sign-up"] as const;

export const PROTECTED_PREFIXES = [
  "/today",
  "/research",
  "/canvas",
  "/create",
  "/plan",
  "/performance",
  "/library",
  "/knowledge",
  "/brand-brain",
  "/connections",
  "/models",
  "/usage",
  "/templates",
  "/settings",
  "/profile",
  "/my-content",
  "/analyze",
] as const;

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export type AuthRedirectDecision =
  | { type: "none" }
  | { type: "redirect"; to: string };

/** Pure redirect policy used by proxy and unit tests. */
export function decideAuthRedirect(
  pathname: string,
  isAuthenticated: boolean,
): AuthRedirectDecision {
  if (!isAuthenticated && isProtectedRoute(pathname)) {
    return { type: "redirect", to: `/sign-in?next=${encodeURIComponent(pathname)}` };
  }
  if (isAuthenticated && isAuthRoute(pathname)) {
    return { type: "redirect", to: "/today" };
  }
  if (isAuthenticated && pathname === "/") {
    return { type: "redirect", to: "/today" };
  }
  if (!isAuthenticated && pathname === "/") {
    return { type: "redirect", to: "/sign-in" };
  }
  return { type: "none" };
}
