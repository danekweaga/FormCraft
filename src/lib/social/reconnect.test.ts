import { describe, expect, it } from "vitest";
import {
  isReconnectRequiredError,
  reconnectRequiredCopy,
} from "./reconnect";

describe("reconnect required errors", () => {
  it("detects Facebook/Instagram session invalidation", () => {
    expect(
      isReconnectRequiredError(
        "Error validating access token: The session has been invalidated because the user changed their password or Facebook has changed the session for security reasons.",
      ),
    ).toBe(true);
  });

  it("ignores ordinary sync failures", () => {
    expect(isReconnectRequiredError("Rate limit exceeded")).toBe(false);
    expect(isReconnectRequiredError(null)).toBe(false);
  });

  it("tells Instagram users to reconnect instead of refresh", () => {
    expect(reconnectRequiredCopy("instagram")).toMatch(/Reconnect/i);
    expect(reconnectRequiredCopy("instagram")).toMatch(/manually/i);
  });
});
