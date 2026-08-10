export type ResearchFeedFilters = {
  keywords: string;
  minOutlier: number;
  maxOutlier: number;
  minViews: number;
  maxViews: number;
  minEngagement: number;
  maxEngagement: number;
  postedWithinValue: number;
  postedWithinUnit: "days" | "weeks" | "months";
  platform: string;
  creator: string;
};

export type FilterableResearchItem = {
  title: string | null;
  description: string | null;
  hook_text?: string | null;
  creator_name: string | null;
  platform: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares?: number | null;
  outlier_score: number | null;
  published_at: string | null;
};

export const DEFAULT_RESEARCH_FILTERS: ResearchFeedFilters = {
  keywords: "",
  minOutlier: 0,
  maxOutlier: 100,
  minViews: 0,
  maxViews: 10_000_000,
  minEngagement: 0,
  maxEngagement: 100,
  postedWithinValue: 12,
  postedWithinUnit: "months",
  platform: "all",
  creator: "all",
};

function engagementRate(item: FilterableResearchItem): number | null {
  if (item.views == null || item.views <= 0) return null;
  const eng =
    (item.likes ?? 0) + (item.comments ?? 0) + (item.shares ?? 0);
  return (eng / item.views) * 100;
}

function postedWithinMs(filters: ResearchFeedFilters): number {
  const value = Math.max(1, filters.postedWithinValue || 1);
  if (filters.postedWithinUnit === "weeks") return value * 7 * 86_400_000;
  if (filters.postedWithinUnit === "months") return value * 30 * 86_400_000;
  return value * 86_400_000;
}

export function filterResearchItems<T extends FilterableResearchItem>(
  items: T[],
  filters: ResearchFeedFilters,
  now = new Date(),
): T[] {
  const keywords = filters.keywords
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const cutoff = now.getTime() - postedWithinMs(filters);

  return items.filter((item) => {
    if (filters.platform !== "all" && item.platform !== filters.platform) {
      return false;
    }
    if (
      filters.creator !== "all" &&
      (item.creator_name ?? "") !== filters.creator
    ) {
      return false;
    }

    const outlier = item.outlier_score ?? 0;
    if (outlier < filters.minOutlier || outlier > filters.maxOutlier) {
      return false;
    }

    const views = item.views ?? 0;
    if (views < filters.minViews || views > filters.maxViews) return false;

    const eng = engagementRate(item);
    if (eng != null) {
      if (eng < filters.minEngagement || eng > filters.maxEngagement) {
        return false;
      }
    } else if (filters.minEngagement > 0) {
      return false;
    }

    if (item.published_at) {
      const published = new Date(item.published_at).getTime();
      if (Number.isFinite(published) && published < cutoff) return false;
    }

    if (keywords.length > 0) {
      const hay =
        `${item.title ?? ""} ${item.description ?? ""} ${item.hook_text ?? ""}`.toLowerCase();
      if (!keywords.every((term) => hay.includes(term))) return false;
    }

    return true;
  });
}
