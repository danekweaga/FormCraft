"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CREATOR_CATALOG } from "@/data/creator-catalog";
import { followCreatorFromCatalogAction } from "./actions";

const platforms = ["all", "instagram", "tiktok", "youtube"] as const;

export function CreatorDirectory({ followed }: { followed: string[] }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<(typeof platforms)[number]>("all");
  const followedSet = useMemo(() => new Set(followed), [followed]);
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return CREATOR_CATALOG.filter(
      (entry) =>
        (platform === "all" || entry.platform === platform) &&
        (!normalized || entry.username.toLowerCase().includes(normalized)),
    );
  }, [platform, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/20 bg-surface-primary p-4 paper-shadow sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search creator directory</span>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search 192 creator accounts..."
            className="h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest pl-10 pr-3 text-sm outline-none focus:border-primary-container"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {platforms.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={platform === value ? "default" : "outline"}
              onClick={() => setPlatform(value)}
            >
              {value === "all" ? "All" : value}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-sm text-secondary">
        Showing {rows.length} workbook entries. Counts are the supplied snapshot, not live metrics.
      </p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((entry) => {
          const key = `${entry.platform}:${entry.username}`;
          const isFollowed = followedSet.has(key);
          return (
            <article key={key} className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4 paper-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-headline text-lg font-semibold text-on-background">@{entry.username}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="default">{entry.platform}</Badge>
                    <Badge variant="primary">{entry.followers} audience</Badge>
                  </div>
                </div>
                <span className="text-xs font-semibold text-secondary">{entry.views} views</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {isFollowed ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/research?mode=watchlists">Following</Link>
                  </Button>
                ) : (
                  <form action={followCreatorFromCatalogAction}>
                    <input type="hidden" name="username" value={entry.username} />
                    <input type="hidden" name="platform" value={entry.platform} />
                    <Button type="submit" size="sm">Follow creator</Button>
                  </form>
                )}
                <Button asChild size="sm" variant="ghost">
                  <a
                    href={
                      entry.platform === "instagram"
                        ? `https://www.instagram.com/${entry.username}/`
                        : entry.platform === "tiktok"
                          ? `https://www.tiktok.com/@${entry.username}`
                          : `https://www.youtube.com/@${entry.username}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open profile
                  </a>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
