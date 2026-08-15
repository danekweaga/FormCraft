"use client";

import { useState } from "react";
import {
  formatCompact,
  formatDayLabel,
  growthBasisLabel,
  metricLabel,
  type Heatmap,
  type HeatmapCell,
} from "@/lib/my-content/growth-series";

const LEVEL_CLASS: Record<HeatmapCell["level"], string> = {
  0: "bg-[#f0f0ec]",
  1: "bg-[#c8c8c2]",
  2: "bg-[#8f8f88]",
  3: "bg-[#52524e]",
  4: "bg-[#171717]",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ImpressionsHeatmap({ heatmap }: { heatmap: Heatmap }) {
  const [active, setActive] = useState<HeatmapCell | null>(null);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {metricLabel(heatmap.metric)}
          </p>
          <p className="mt-1 font-headline text-3xl font-bold text-on-background">
            {heatmap.total.toLocaleString()}{" "}
            <span className="font-sans text-sm font-medium text-secondary">
              past year
            </span>
          </p>
        </div>
        <p className="max-w-xs text-right text-xs leading-relaxed text-secondary">
          {growthBasisLabel(heatmap.basis)}
        </p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="inline-flex min-w-full gap-2">
          <div className="flex shrink-0 flex-col justify-between pt-5 pb-1 text-[10px] text-secondary">
            {DAY_LABELS.map((label, index) => (
              <span key={label} className={index % 2 === 1 ? "" : "opacity-0"}>
                {label}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="mb-1 grid gap-[3px] text-[10px] text-secondary"
              style={{
                gridTemplateColumns: `repeat(${heatmap.weeks.length}, minmax(0, 1fr))`,
              }}
            >
              {heatmap.weeks.map((_, weekIndex) => {
                const label = heatmap.monthLabels.find(
                  (month) => month.index === weekIndex,
                );
                return (
                  <span key={weekIndex} className="whitespace-nowrap">
                    {label?.label ?? ""}
                  </span>
                );
              })}
            </div>

            <div
              className="grid gap-[3px]"
              style={{
                gridTemplateColumns: `repeat(${heatmap.weeks.length}, minmax(0, 1fr))`,
              }}
            >
              {heatmap.weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-rows-7 gap-[3px]">
                  {week.cells.map((cell, dayIndex) =>
                    cell && !cell.future ? (
                      <button
                        key={cell.date}
                        type="button"
                        onMouseEnter={() => setActive(cell)}
                        onFocus={() => setActive(cell)}
                        onMouseLeave={() => setActive(null)}
                        onBlur={() => setActive(null)}
                        aria-label={`${formatDayLabel(cell.date)}: ${cell.value.toLocaleString()} ${metricLabel(heatmap.metric)}`}
                        className={`aspect-square w-full rounded-[3px] transition-transform hover:scale-125 ${LEVEL_CLASS[cell.level]}`}
                      />
                    ) : (
                      <div
                        key={cell?.date ?? `${weekIndex}-${dayIndex}`}
                        className="aspect-square w-full rounded-[3px]"
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="min-h-5 text-xs text-secondary">
          {active
            ? `${formatDayLabel(active.date)} · ${formatCompact(active.value)} ${metricLabel(heatmap.metric)}${
                active.postCount > 0
                  ? ` · ${active.postCount} post${active.postCount === 1 ? "" : "s"} published`
                  : ""
              }`
            : "Hover a day for detail."}
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-secondary">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span
              key={level}
              className={`h-3 w-3 rounded-[3px] ${LEVEL_CLASS[level]}`}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
