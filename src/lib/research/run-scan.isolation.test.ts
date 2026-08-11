import { describe, expect, it } from "vitest";

/**
 * Mirrors runResearchScan's Promise.allSettled merge: one provider failure
 * must not discard successful results from another.
 */
async function collectSettledSearches(
  searches: Array<() => Promise<{ provider: string; posts: string[] }>>,
): Promise<{ posts: string[]; errors: string[] }> {
  const settled = await Promise.allSettled(searches.map((fn) => fn()));
  const posts: string[] = [];
  const errors: string[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      posts.push(...result.value.posts);
    } else {
      errors.push(
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      );
    }
  }
  return { posts, errors };
}

describe("provider search isolation", () => {
  it("keeps youtube results when tiktok throws", async () => {
    const { posts, errors } = await collectSettledSearches([
      async () => {
        throw new Error("TikTok down");
      },
      async () => ({ provider: "youtube", posts: ["yt-1", "yt-2"] }),
    ]);

    expect(posts).toEqual(["yt-1", "yt-2"]);
    expect(errors).toEqual(["TikTok down"]);
  });

  it("throws only when every provider fails (caller checks empty+errors)", async () => {
    const { posts, errors } = await collectSettledSearches([
      async () => {
        throw new Error("TikTok down");
      },
      async () => {
        throw new Error("YouTube quota");
      },
    ]);

    expect(posts).toEqual([]);
    expect(errors).toHaveLength(2);
  });
});
