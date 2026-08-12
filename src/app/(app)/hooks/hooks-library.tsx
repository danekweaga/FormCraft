"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HookLibraryItem } from "@/lib/library/hook-library";

function metric(item: HookLibraryItem): string {
  if (item.sourceKind === "starter") return "Reusable template · no performance claim";
  if (item.sourceKind === "my_content") {
    if (item.relativePerformance != null) return `${item.relativePerformance.toFixed(1)}x personal baseline`;
    if (item.views != null) return `${item.views.toLocaleString()} views`;
    return "Personal metrics unavailable";
  }
  if (item.outlierScore != null) return `${item.outlierScore.toFixed(1)}x creator baseline`;
  return "External outlier score unavailable";
}

export function HooksLibrary({ items }: { items: HookLibraryItem[] }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | "starter" | "my_content" | "research" | "analysis" | "canvas">("all");
  const [visibleCount, setVisibleCount] = useState(30);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSource = source === "all" || item.sourceKind === source;
      const haystack = [
        item.hook,
        item.topic,
        item.creator,
        item.hookType,
        item.assessment,
        ...item.mechanisms,
        ...(item.requirements ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesSource && (!normalized || haystack.includes(normalized));
    });
  }, [items, query, source]);
  const visible = filtered.slice(0, visibleCount);

  async function copyTemplate(item: HookLibraryItem) {
    await navigator.clipboard.writeText(item.hook);
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1600);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/20 bg-surface-primary p-4 paper-shadow lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search hooks</span>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search hooks, creators, topics, or mechanisms..."
            className="h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest pl-10 pr-3 text-sm outline-none focus:border-primary-container"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(["all", "starter", "my_content", "research", "analysis", "canvas"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={source === value ? "default" : "outline"}
              onClick={() => setSource(value)}
            >
              {value === "all" ? "All" : value.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant/30 p-10 text-center text-sm text-secondary">
          No evidence-backed hooks match this filter. Analyze or classify more videos first.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <article key={item.id} className="rounded-xl border border-outline-variant/20 bg-surface-primary p-4 paper-shadow">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={item.sourceKind === "my_content" ? "success" : "primary"}>
                      {item.sourceKind.replace("_", " ")}
                    </Badge>
                    <Badge variant="default">{item.platform}</Badge>
                    {item.hookType ? <Badge variant="default">{item.hookType}</Badge> : null}
                    {item.format ? <Badge variant="default">{item.format}</Badge> : null}
                  </div>
                  <blockquote className="mt-3 font-headline text-lg font-semibold leading-snug text-on-background">
                    “{item.hook}”
                  </blockquote>
                  <p className="mt-2 text-sm text-secondary">
                    {[item.creator, item.topic, item.sourceLabel].filter(Boolean).join(" · ")}
                  </p>
                  {item.explanation ? <p className="mt-3 text-sm leading-relaxed text-secondary">{item.explanation}</p> : null}
                  {item.assessment ? <p className="mt-2 text-xs leading-relaxed text-secondary">{item.assessment}</p> : null}
                  {item.mechanisms.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.mechanisms.map((mechanism) => (
                        <Badge key={mechanism} variant="primary">{mechanism}</Badge>
                      ))}
                    </div>
                  ) : null}
                  {item.requirements?.length ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Requirements</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.requirements.map((requirement) => (
                          <Badge key={requirement} variant="default">{requirement.replaceAll("_", " ")}</Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {item.ratings.length ? (
                    <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {item.ratings.map((rating) => (
                        <div key={`${rating.category}:${rating.rating}`} className="rounded-lg bg-surface-container-lowest p-3">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">{rating.category}</dt>
                          <dd className="mt-1 text-sm font-semibold text-on-background">{rating.rating}</dd>
                          <p className="mt-1 text-xs text-secondary">{rating.explanation}</p>
                        </div>
                      ))}
                    </dl>
                  ) : item.sourceKind !== "starter" ? (
                    <p className="mt-3 text-xs text-secondary">Qualitative dimensions have not been evaluated for this hook yet.</p>
                  ) : null}
                </div>
                <div className="shrink-0 lg:text-right">
                  <p className="text-sm font-semibold text-on-background">{metric(item)}</p>
                  <div className="mt-3 flex gap-2 lg:justify-end">
                    {item.sourceKind === "starter" ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void copyTemplate(item)}>
                        {copiedId === item.id ? "Copied" : "Copy template"}
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link href={item.sourceHref}>Open evidence</Link>
                      </Button>
                    )}
                    {item.researchItemId ? (
                      <Button asChild size="sm">
                        <Link href={`/create?researchItem=${encodeURIComponent(item.researchItemId)}`}>Create my version</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
          {visible.length < filtered.length ? (
            <div className="flex justify-center pt-2">
              <Button type="button" variant="outline" onClick={() => setVisibleCount((count) => count + 30)}>
                Show 30 more ({filtered.length - visible.length} remaining)
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
