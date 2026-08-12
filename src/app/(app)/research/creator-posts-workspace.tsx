"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ResearchItemCard,
  type ResearchCardItem,
} from "./research-item-card";
import { refreshCreatorPostsAction } from "./actions";

type SortKey = "outlier" | "date" | "views";
type ViewMode = "outliers" | "all";

export function CreatorPostsWorkspace({
  creatorId,
  platform,
  posts,
  watchlists,
  canAutoPull,
}: {
  creatorId: string;
  platform: string;
  posts: ResearchCardItem[];
  watchlists: Array<{ id: string; name: string }>;
  canAutoPull: boolean;
}) {
  const [mode, setMode] = useState<ViewMode>("outliers");
  const [sort, setSort] = useState<SortKey>("outlier");
  const [pending, start] = useTransition();
  const [pullMessage, setPullMessage] = useState<string | null>(null);

  const visible = useMemo(() => {
    const base =
      mode === "outliers"
        ? posts.filter((p) => (p.outlier_score ?? 0) >= 1.5)
        : posts;
    const sorted = [...base];
    sorted.sort((a, b) => {
      if (sort === "views") {
        return (b.views ?? 0) - (a.views ?? 0);
      }
      if (sort === "date") {
        const at = a.published_at ? new Date(a.published_at).getTime() : 0;
        const bt = b.published_at ? new Date(b.published_at).getTime() : 0;
        return bt - at;
      }
      return (b.outlier_score ?? 0) - (a.outlier_score ?? 0);
    });
    return sorted;
  }, [mode, posts, sort]);

  const outlierCount = posts.filter((p) => (p.outlier_score ?? 0) >= 1.5).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">{posts.length} posts</Badge>
        <Badge variant="success">{outlierCount} outliers (≥1.5×)</Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          {canAutoPull ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const fd = new FormData();
                  fd.set("creatorId", creatorId);
                  const result = await refreshCreatorPostsAction(fd);
                  setPullMessage(
                    result.success ?? result.error ?? "Pull finished.",
                  );
                })
              }
            >
              {pending ? "Pulling…" : "Pull posts now"}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={mode === "outliers" ? "default" : "outline"}
            onClick={() => setMode("outliers")}
          >
            Outliers only
          </Button>
          <Button
            size="sm"
            variant={mode === "all" ? "default" : "outline"}
            onClick={() => setMode("all")}
          >
            All posts
          </Button>
          <select
            className="h-9 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort posts"
          >
            <option value="outlier">Sort: outlier score</option>
            <option value="date">Sort: date</option>
            <option value="views">Sort: views</option>
          </select>
        </div>
      </div>

      {pullMessage ? (
        <p className="text-sm text-secondary">{pullMessage}</p>
      ) : null}

      <p className="text-xs text-secondary">
        Open originals to sanity-check scores. Analyze and Add to Canvas when a
        post looks worth studying
        {platform === "instagram"
          ? " (Instagram Reels via ScrapeCreators)."
          : "."}
      </p>

      {posts.length === 0 ? (
        <EmptyState
          title="No posts linked yet"
          description={
            canAutoPull
              ? "Hit Pull posts now to fetch recent videos and score them vs this creator’s median."
              : "No discovery provider is configured for this platform. Add SCRAPECREATORS_API_KEY for Instagram/TikTok, or YOUTUBE_DATA_API_KEY for YouTube."
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No outliers at ≥1.5× yet"
          description="Try All posts, or pull more recent videos. Outliers appear when a post beats this creator’s median views."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {visible.map((item) => (
            <ResearchItemCard
              key={item.id}
              item={item}
              watchlists={watchlists}
            />
          ))}
        </div>
      )}
    </div>
  );
}
