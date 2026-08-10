"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SearchResult = {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  href: string;
};

const actions = [
  ["Analyze video", "/analyze"],
  ["Find outliers", "/research?mode=outliers"],
  ["Search niche", "/research?mode=discover"],
  ["Add creator", "/creators"],
  ["Create idea", "/idea-gate"],
  ["Add knowledge", "/knowledge"],
  ["Search psychology", "/psychology"],
  ["Create experiment", "/experiments"],
  ["Open Canvas", "/canvas"],
] as const;

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search failed");
        const payload = (await response.json()) as { results?: SearchResult[] };
        setResults(payload.results ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-10 w-full max-w-xl items-center gap-3 rounded-full bg-surface-container-low px-4 text-left text-sm text-secondary transition hover:bg-surface-container sm:flex"
      >
        <Search className="size-4" />
        <span className="flex-1">Search everything or run a command...</span>
        <kbd className="rounded border border-outline-variant/30 bg-surface-primary px-2 py-0.5 text-[10px]">Ctrl K</kbd>
      </button>
      <Button type="button" variant="ghost" size="icon" className="sm:hidden" onClick={() => setOpen(true)} aria-label="Open global search">
        <Search className="size-5" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-on-background/35 px-4 pt-[10vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Global search and commands" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-primary paper-shadow">
            <div className="flex items-center gap-3 border-b border-outline-variant/20 px-4">
              <Search className="size-5 text-secondary" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  const value = event.target.value;
                  setQuery(value);
                  if (value.trim().length < 2) {
                    setResults([]);
                    setLoading(false);
                  }
                }}
                placeholder="Search creators, videos, hooks, ideas, knowledge..."
                className="h-14 flex-1 bg-transparent text-sm outline-none"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close"><X className="size-4" /></Button>
            </div>
            <div className="custom-scrollbar max-h-[65vh] overflow-y-auto p-3">
              {query.trim().length < 2 ? (
                <div>
                  <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-widest text-secondary">Commands</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {actions.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-on-background hover:bg-surface-container-low">{label}</Link>)}
                  </div>
                </div>
              ) : loading ? (
                <p className="p-5 text-sm text-secondary">Searching your workspace...</p>
              ) : results.length ? (
                <div className="space-y-1">
                  {results.map((result) => (
                    <Link key={result.id} href={result.href} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-lg p-3 hover:bg-surface-container-low">
                      <Badge variant="default">{result.kind}</Badge>
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold text-on-background">{result.title}</span>{result.subtitle ? <span className="mt-0.5 block truncate text-xs text-secondary">{result.subtitle}</span> : null}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="p-5 text-sm text-secondary">No matching workspace items.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
