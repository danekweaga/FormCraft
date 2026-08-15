"use client";

import { useMemo, useRef, useState } from "react";
import {
  formatCompact,
  formatDayLabel,
  formatShortDayLabel,
  growthBasisLabel,
  metricLabel,
  type GrowthMetric,
  type GrowthSeries,
} from "@/lib/my-content/growth-series";

const WIDTH = 960;
const HEIGHT = 320;
const PADDING = { top: 24, right: 24, bottom: 32, left: 56 };

const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

function buildPath(
  points: Array<{ x: number; y: number }>,
  close: boolean,
): string {
  if (points.length === 0) return "";
  // Monotone-ish smoothing: midpoint quadratic curves avoid overshoot.
  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const midX = (previous.x + current.x) / 2;
    path += ` Q ${previous.x} ${previous.y} ${midX} ${(previous.y + current.y) / 2}`;
    path += ` Q ${current.x} ${current.y} ${current.x} ${current.y}`;
  }
  if (close) {
    path += ` L ${points[points.length - 1]!.x} ${PADDING.top + PLOT_HEIGHT}`;
    path += ` L ${points[0]!.x} ${PADDING.top + PLOT_HEIGHT} Z`;
  }
  return path;
}

export function GrowthChart({
  impressions,
  followers,
  rangeLabel,
}: {
  impressions: GrowthSeries;
  followers: GrowthSeries;
  rangeLabel: string;
}) {
  const [metric, setMetric] = useState<GrowthMetric>("impressions");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const series = metric === "impressions" ? impressions : followers;
  const points = series.points;

  const geometry = useMemo(() => {
    const maxValue = Math.max(1, ...points.map((point) => point.value));
    const step = points.length > 1 ? PLOT_WIDTH / (points.length - 1) : 0;
    const coords = points.map((point, index) => ({
      x: PADDING.left + index * step,
      y:
        PADDING.top +
        PLOT_HEIGHT -
        (point.value / maxValue) * PLOT_HEIGHT,
    }));
    return { maxValue, step, coords };
  }, [points]);

  const activeIndex =
    hoverIndex != null && hoverIndex >= 0 && hoverIndex < points.length
      ? hoverIndex
      : null;
  const activePoint = activeIndex != null ? points[activeIndex]! : null;
  const activeCoord = activeIndex != null ? geometry.coords[activeIndex]! : null;

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const bounds = svg.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const x = ratio * WIDTH;
    const index = Math.round((x - PADDING.left) / (geometry.step || 1));
    setHoverIndex(Math.min(points.length - 1, Math.max(0, index)));
  }

  const markers = points
    .map((point, index) => ({ point, index }))
    .filter((entry) => entry.point.posts.length > 0);

  const gridValues = [0, 0.5, 1];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-headline text-lg font-semibold text-on-background">
              Growth
            </h3>
            <div className="flex rounded-full bg-surface-container-low p-1">
              {(["impressions", "followers"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMetric(value)}
                  className={
                    metric === value
                      ? "rounded-full bg-surface-primary px-3.5 py-1.5 text-xs font-semibold capitalize text-on-background paper-shadow"
                      : "rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize text-secondary hover:text-on-background"
                  }
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 font-headline text-3xl font-bold text-on-background">
            {formatCompact(series.total)}{" "}
            <span className="font-sans text-sm font-medium text-secondary">
              {metricLabel(metric)} · {rangeLabel}
            </span>
          </p>
        </div>
        <p className="max-w-xs text-right text-xs leading-relaxed text-secondary">
          {growthBasisLabel(series.basis)}
        </p>
      </div>

      {series.total === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-outline-variant/30 text-sm text-secondary">
          No {metricLabel(metric)} recorded in this range.
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full touch-none"
            role="img"
            aria-label={`${metricLabel(metric)} over ${rangeLabel}`}
            onPointerMove={handleMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#171717" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#171717" stopOpacity="0" />
              </linearGradient>
            </defs>

            {gridValues.map((fraction) => {
              const y = PADDING.top + PLOT_HEIGHT * (1 - fraction);
              return (
                <g key={fraction}>
                  <line
                    x1={PADDING.left}
                    x2={WIDTH - PADDING.right}
                    y1={y}
                    y2={y}
                    stroke="#d8d8d2"
                    strokeOpacity="0.9"
                  />
                  <text
                    x={PADDING.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fill="#6b6b66"
                    fontSize="11"
                  >
                    {formatCompact(geometry.maxValue * fraction)}
                  </text>
                </g>
              );
            })}

            <path d={buildPath(geometry.coords, true)} fill="url(#growth-fill)" />
            <path
              d={buildPath(geometry.coords, false)}
              fill="none"
              stroke="#171717"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {markers.map(({ index }) => {
              const coord = geometry.coords[index]!;
              return (
                <circle
                  key={index}
                  cx={coord.x}
                  cy={coord.y}
                  r={activeIndex === index ? 6 : 4}
                  fill="#171717"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              );
            })}

            {activeCoord ? (
              <g>
                <line
                  x1={activeCoord.x}
                  x2={activeCoord.x}
                  y1={PADDING.top}
                  y2={PADDING.top + PLOT_HEIGHT}
                  stroke="#8a8a84"
                  strokeOpacity="0.55"
                  strokeDasharray="4 4"
                />
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r="5"
                  fill="#171717"
                />
              </g>
            ) : null}

            {points.length > 1
              ? [0, Math.floor(points.length / 2), points.length - 1].map(
                  (index) => (
                    <text
                      key={index}
                      x={geometry.coords[index]!.x}
                      y={HEIGHT - 8}
                      textAnchor={
                        index === 0
                          ? "start"
                          : index === points.length - 1
                            ? "end"
                            : "middle"
                      }
                      fill="#6b6b66"
                      fontSize="11"
                    >
                      {formatShortDayLabel(points[index]!.date)}
                    </text>
                  ),
                )
              : null}
          </svg>

          {activePoint ? (
            <div
              className="pointer-events-none absolute top-2 z-10 w-64 rounded-xl border border-outline-variant/25 bg-surface-primary p-3 text-left paper-shadow"
              style={{
                left: `${Math.min(78, Math.max(2, ((activeCoord!.x - PADDING.left) / PLOT_WIDTH) * 100))}%`,
              }}
            >
              <p className="text-xs font-semibold text-on-background">
                {formatCompact(activePoint.value)} {metricLabel(metric)}
              </p>
              <p className="text-[11px] text-secondary">
                {formatDayLabel(activePoint.date)}
              </p>
              {activePoint.posts.slice(0, 2).map((post) => (
                <div
                  key={post.id}
                  className="mt-2 flex gap-2 border-t border-outline-variant/15 pt-2"
                >
                  {post.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.thumbnailUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-on-background">
                      {post.title}
                    </p>
                    <p className="text-[11px] text-secondary">
                      {post.views != null
                        ? `${formatCompact(post.views)} views`
                        : "Views unavailable"}
                      {post.engagements != null
                        ? ` · ${formatCompact(post.engagements)} eng.`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
              {activePoint.posts.length > 2 ? (
                <p className="mt-1 text-[11px] text-secondary">
                  +{activePoint.posts.length - 2} more published this day
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
