"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_RESEARCH_FILTERS,
  filterResearchItems,
  type ResearchFeedFilters,
} from "@/lib/research/feed-filters";
import { MIN_RESEARCH_VIEWS } from "@/lib/research/visibility-policy";
import {
  deleteSavedResearchFilterAction,
  saveResearchFilterAction,
  type ResearchActionState,
} from "./actions";
import {
  ResearchItemCard,
  type ResearchCardItem,
} from "./research-item-card";

const initialState: ResearchActionState = {};

export type SavedResearchFilterOption = {
  id: string;
  name: string;
  filters: ResearchFeedFilters;
};

export function ResearchFeedWithFilters({
  items,
  watchlists,
  savedFilters = [],
  showDismissActions = false,
}: {
  items: ResearchCardItem[];
  watchlists: Array<{ id: string; name: string }>;
  savedFilters?: SavedResearchFilterOption[];
  showDismissActions?: boolean;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<ResearchFeedFilters>(
    DEFAULT_RESEARCH_FILTERS,
  );
  const [saveState, saveAction, savePending] = useActionState(
    saveResearchFilterAction,
    initialState,
  );
  const [selectedSavedFilter, setSelectedSavedFilter] = useState("");

  useEffect(() => {
    if (saveState.success) router.refresh();
  }, [router, saveState.success]);

  const activeSavedFilter = savedFilters.some(
    (option) => option.id === selectedSavedFilter,
  )
    ? selectedSavedFilter
    : "";

  const creators = useMemo(() => {
    const names = Array.from(
      new Set(items.map((i) => i.creator_name).filter(Boolean)),
    ) as string[];
    return names.sort();
  }, [items]);

  const platforms = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.platform))).sort();
  }, [items]);

  const filtered = useMemo(
    () => filterResearchItems(items, filters),
    [items, filters],
  );

  function set<K extends keyof ResearchFeedFilters>(
    key: K,
    value: ResearchFeedFilters[K],
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="h-fit rounded-xl border border-outline-variant/20 bg-surface-primary p-4 paper-shadow">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
          Filter collected videos
        </p>
        <p className="mb-4 text-xs text-secondary">
          These controls only narrow videos already collected by a discovery
          scan. They do not search YouTube or TikTok.
        </p>
        <div className="space-y-4">
          {savedFilters.length > 0 ? (
            <div className="space-y-1.5 rounded-lg border border-primary-container/25 bg-primary-container/5 p-3">
              <Label htmlFor="saved-research-filter">Load saved filter</Label>
              <select
                id="saved-research-filter"
                className="h-10 w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
                value={activeSavedFilter}
                onChange={(event) => {
                  const id = event.target.value;
                  setSelectedSavedFilter(id);
                  const saved = savedFilters.find((option) => option.id === id);
                  if (saved) setFilters(saved.filters);
                }}
              >
                <option value="">Choose a saved filter</option>
                {savedFilters.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <ul className="space-y-1">
                {savedFilters.map((option) => (
                  <li
                    key={option.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-outline-variant/15 px-2 py-1"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-xs text-secondary hover:text-on-background"
                      onClick={() => {
                        setSelectedSavedFilter(option.id);
                        setFilters(option.filters);
                      }}
                    >
                      {option.name}
                    </button>
                    <form action={deleteSavedResearchFilterAction}>
                      <input type="hidden" name="id" value={option.id} />
                      <ConfirmDeleteButton
                        label="Delete"
                        confirmMessage={`Delete saved filter “${option.name}”?`}
                        variant="ghost"
                        className="h-7 px-2 text-error"
                      />
                    </form>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-secondary">
                Loading a filter restores every saved limit exactly.
              </p>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>All channels</Label>
            <select
              className="h-10 w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
              value={filters.creator}
              onChange={(e) => set("creator", e.target.value)}
            >
              <option value="all">All channels</option>
              {creators.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Keywords</Label>
            <Input
              placeholder="Filter collected captions and titles"
              value={filters.keywords}
              onChange={(e) => set("keywords", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Outlier score</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                step="0.1"
                value={filters.minOutlier}
                onChange={(e) => set("minOutlier", Number(e.target.value))}
                placeholder="0x"
              />
              <Input
                type="number"
                step="0.1"
                value={filters.maxOutlier}
                onChange={(e) => set("maxOutlier", Number(e.target.value))}
                placeholder="100x"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Views (20K hard minimum)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={MIN_RESEARCH_VIEWS}
                value={filters.minViews}
                onChange={(e) =>
                  set(
                    "minViews",
                    Math.max(MIN_RESEARCH_VIEWS, Number(e.target.value)),
                  )
                }
              />
              <Input
                type="number"
                min={MIN_RESEARCH_VIEWS}
                value={filters.maxViews}
                onChange={(e) => set("maxViews", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Engagement %</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                value={filters.minEngagement}
                onChange={(e) => set("minEngagement", Number(e.target.value))}
              />
              <Input
                type="number"
                value={filters.maxEngagement}
                onChange={(e) => set("maxEngagement", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Posted in last</Label>
            <div className="grid grid-cols-[1fr_1fr] gap-2">
              <Input
                type="number"
                min={1}
                value={filters.postedWithinValue}
                onChange={(e) =>
                  set("postedWithinValue", Number(e.target.value))
                }
              />
              <select
                className="h-10 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
                value={filters.postedWithinUnit}
                onChange={(e) =>
                  set(
                    "postedWithinUnit",
                    e.target.value as ResearchFeedFilters["postedWithinUnit"],
                  )
                }
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Platform</Label>
            <select
              className="h-10 w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
              value={filters.platform}
              onChange={(e) => set("platform", e.target.value)}
            >
              <option value="all">All platforms</option>
              {platforms.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </div>

          <form action={saveAction} className="space-y-2 border-t border-outline-variant/15 pt-4">
            <input type="hidden" name="keywords" value={filters.keywords} />
            <input type="hidden" name="minOutlier" value={filters.minOutlier} />
            <input type="hidden" name="maxOutlier" value={filters.maxOutlier} />
            <input type="hidden" name="minViews" value={filters.minViews} />
            <input type="hidden" name="maxViews" value={filters.maxViews} />
            <input
              type="hidden"
              name="minEngagement"
              value={filters.minEngagement}
            />
            <input
              type="hidden"
              name="maxEngagement"
              value={filters.maxEngagement}
            />
            <input
              type="hidden"
              name="postedWithinValue"
              value={filters.postedWithinValue}
            />
            <input
              type="hidden"
              name="postedWithinUnit"
              value={filters.postedWithinUnit}
            />
            <input type="hidden" name="platform" value={filters.platform} />
            <input type="hidden" name="creator" value={filters.creator} />
            <Input name="name" placeholder="Filter name" defaultValue="Outliers" />
            <Button type="submit" className="w-full" disabled={savePending}>
              {savePending ? "Saving…" : "Save filter"}
            </Button>
            {saveState.error ? (
              <p className="text-xs text-error">{saveState.error}</p>
            ) : null}
            {saveState.success ? (
              <p className="text-xs text-primary-container">{saveState.success}</p>
            ) : null}
          </form>
        </div>
      </aside>

      <div>
        <p className="mb-4 text-sm text-secondary">
          Showing {filtered.length} of {items.length} posts
        </p>
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant/30 p-8 text-sm text-secondary">
            <p>
              {items.length === 0
                ? "No videos have been collected yet. Run a live discovery scan first."
                : "No collected videos match these filters."}
            </p>
            {items.length === 0 ? (
              <Button asChild size="sm" className="mt-4">
                <Link href="/research?mode=discover">Discover public videos</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((item) => (
              <ResearchItemCard
                key={item.id}
                item={item}
                watchlists={watchlists}
                showDismissActions={showDismissActions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
