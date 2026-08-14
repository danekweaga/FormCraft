import { describe, expect, it } from "vitest";
import { interleaveCreatorTargets } from "./fair-creator-targets";

describe("interleaveCreatorTargets", () => {
  it("gives every configured platform space in the scheduled prefix", () => {
    const targets = [
      ...Array.from({ length: 6 }, (_, index) => ({
        platform: "youtube",
        id: `yt-${index}`,
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        platform: "tiktok",
        id: `tt-${index}`,
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        platform: "instagram",
        id: `ig-${index}`,
      })),
    ];

    const firstSix = interleaveCreatorTargets(targets, [
      "youtube",
      "tiktok",
      "instagram",
    ]).slice(0, 6);

    expect(firstSix.map((target) => target.platform)).toEqual([
      "youtube",
      "tiktok",
      "instagram",
      "youtube",
      "tiktok",
      "instagram",
    ]);
  });

  it("preserves stale-first order within each platform", () => {
    const targets = [
      { platform: "instagram", id: "oldest-ig" },
      { platform: "youtube", id: "oldest-yt" },
      { platform: "instagram", id: "newer-ig" },
      { platform: "youtube", id: "newer-yt" },
    ];

    const result = interleaveCreatorTargets(targets, ["youtube", "instagram"]);

    expect(result.map((target) => target.id)).toEqual([
      "oldest-yt",
      "oldest-ig",
      "newer-yt",
      "newer-ig",
    ]);
  });
});
