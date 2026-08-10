import {
  buildCumulativePoints,
  type DashboardPoint,
} from "@/lib/my-content/account-dashboard";
import {
  formatCompact,
  formatShortDayLabel,
  growthBasisLabel,
  type GrowthSeries,
} from "@/lib/my-content/growth-series";

const WIDTH = 360;
const HEIGHT = 170;
const PAD = { top: 14, right: 12, bottom: 28, left: 38 };
const PLOT_WIDTH = WIDTH - PAD.left - PAD.right;
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;

function linePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function MiniChart({
  title,
  points,
  kind,
  accent = "var(--color-primary-container)",
}: {
  title: string;
  points: DashboardPoint[];
  kind: "bar" | "line";
  accent?: string;
}) {
  const values = points.map((point) => point.value);
  const maximum = Math.max(0, ...values);
  const minimum = kind === "line" && values.length > 0 ? Math.min(...values) : 0;
  const span = Math.max(1, maximum - minimum);
  const step = points.length > 1 ? PLOT_WIDTH / (points.length - 1) : PLOT_WIDTH;
  const coords = points.map((point, index) => ({
    x: PAD.left + index * step,
    y: PAD.top + PLOT_HEIGHT - ((point.value - minimum) / span) * PLOT_HEIGHT,
  }));
  const hasData = values.some((value) => value !== 0);
  const barWidth = Math.max(1, Math.min(12, (PLOT_WIDTH / Math.max(1, points.length)) * 0.62));

  return (
    <div className="rounded-lg bg-surface-container-lowest p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-on-background">{title}</h3>
        <span className="text-xs font-medium text-secondary">
          {formatCompact(kind === "line" ? (values.at(-1) ?? 0) : values.reduce((sum, value) => sum + value, 0))}
        </span>
      </div>
      {!hasData && kind === "bar" ? (
        <div className="flex h-[170px] items-center justify-center rounded-lg border border-dashed border-outline-variant/25 text-xs text-secondary">
          No measured change in this range
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={`${title} chart`}
        >
          {[0, 0.5, 1].map((fraction) => {
            const y = PAD.top + PLOT_HEIGHT * (1 - fraction);
            const label = minimum + span * fraction;
            return (
              <g key={fraction}>
                <line
                  x1={PAD.left}
                  x2={WIDTH - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="var(--color-outline-variant)"
                  strokeOpacity="0.28"
                />
                <text
                  x={PAD.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[var(--color-secondary)] text-[9px]"
                >
                  {formatCompact(label)}
                </text>
              </g>
            );
          })}

          {kind === "bar"
            ? coords.map((coord, index) => {
                const value = points[index]!.value;
                const height = maximum > 0 ? (value / maximum) * PLOT_HEIGHT : 0;
                return (
                  <rect
                    key={points[index]!.date}
                    x={coord.x - barWidth / 2}
                    y={PAD.top + PLOT_HEIGHT - height}
                    width={barWidth}
                    height={height}
                    rx="2"
                    fill={accent}
                    opacity={value > 0 ? 0.9 : 0}
                  />
                );
              })
            : (
                <>
                  <path
                    d={linePath(coords)}
                    fill="none"
                    stroke={accent}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {coords.length > 0 ? (
                    <circle
                      cx={coords.at(-1)!.x}
                      cy={coords.at(-1)!.y}
                      r="3.5"
                      fill={accent}
                    />
                  ) : null}
                </>
              )}

          {points.length > 0 ? (
            <>
              <text
                x={PAD.left}
                y={HEIGHT - 7}
                textAnchor="start"
                className="fill-[var(--color-secondary)] text-[9px]"
              >
                {formatShortDayLabel(points[0]!.date)}
              </text>
              <text
                x={WIDTH - PAD.right}
                y={HEIGHT - 7}
                textAnchor="end"
                className="fill-[var(--color-secondary)] text-[9px]"
              >
                {formatShortDayLabel(points.at(-1)!.date)}
              </text>
            </>
          ) : null}
        </svg>
      )}
    </div>
  );
}

export function DashboardCharts({
  views,
  followerChanges,
  currentFollowers,
  followerBasis,
}: {
  views: GrowthSeries;
  followerChanges: DashboardPoint[];
  currentFollowers: number | null;
  followerBasis: string;
}) {
  const dailyViews = views.points.map((point) => ({
    date: point.date,
    value: point.value,
  }));
  const cumulativeViews = buildCumulativePoints(dailyViews);
  const followerChangeTotal = followerChanges.reduce(
    (total, point) => total + point.value,
    0,
  );
  const followerStart =
    currentFollowers !== null
      ? Math.max(0, currentFollowers - followerChangeTotal)
      : 0;
  const cumulativeFollowers = buildCumulativePoints(
    followerChanges,
    followerStart,
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-lg font-semibold text-on-background">
            Performance charts
          </h2>
          <p className="mt-1 text-xs text-secondary">
            {growthBasisLabel(views.basis)}.
          </p>
        </div>
        <p className="max-w-sm text-right text-xs text-secondary">
          Follower basis: {followerBasis}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <MiniChart title="Views by day" points={dailyViews} kind="bar" />
        <MiniChart title="Cumulative views" points={cumulativeViews} kind="line" />
        <MiniChart
          title="Followers gained by day"
          points={followerChanges}
          kind="bar"
          accent="var(--color-tertiary-container)"
        />
        <MiniChart
          title="Cumulative followers"
          points={cumulativeFollowers}
          kind="line"
          accent="var(--color-tertiary-container)"
        />
      </div>
    </div>
  );
}
