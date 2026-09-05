// Small hand-rolled SVG charts. No charting library is used anywhere else
// in this app, so a bar/line chart here is built the same way rather than
// pulling in a new dependency for two components.

export interface ChartPoint {
  label: string;
  value: number;
}

// "₹1.5L", "₹42k" - the compact Indian-notation the wireframe's chart
// labels use, so a bar's value fits above it without crowding.
export function formatCompact(value: number, prefix = '') {
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `${prefix}${(value / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000) return `${prefix}${(value / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${prefix}${(value / 1_000).toFixed(0)}k`;
  return `${prefix}${value}`;
}

const WIDTH = 600;
const HEIGHT = 180;
const PAD_X = 28;
const PAD_TOP = 26;

export function BarChart({
  data,
  formatValue = (v) => formatCompact(v, '₹'),
  ariaLabel,
}: {
  data: ChartPoint[];
  formatValue?: (value: number) => string;
  ariaLabel: string;
}) {
  if (data.length === 0) {
    return <p className="empty-note">No data for this selection.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = 18;
  const barWidth = (WIDTH - PAD_X * 2 - gap * (data.length - 1)) / data.length;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT + 34}`}
      className="chart-svg"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
    >
      {data.map((point, index) => {
        const barHeight = max > 0 ? (point.value / max) * (HEIGHT - PAD_TOP) : 0;
        const x = PAD_X + index * (barWidth + gap);
        const y = HEIGHT - barHeight;
        return (
          <g key={point.label}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} rx={5} className="chart-bar" />
            <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" className="chart-bar-value">
              {formatValue(point.value)}
            </text>
            <text x={x + barWidth / 2} y={HEIGHT + 22} textAnchor="middle" className="chart-axis-label">
              {point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({
  data,
  formatValue = (v) => formatCompact(v, ''),
  ariaLabel,
}: {
  data: ChartPoint[];
  formatValue?: (value: number) => string;
  ariaLabel: string;
}) {
  if (data.length === 0) {
    return <p className="empty-note">No data for this selection.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? (WIDTH - PAD_X * 2) / (data.length - 1) : 0;
  const points = data.map((point, index) => ({
    ...point,
    x: PAD_X + index * stepX,
    y: HEIGHT - (max > 0 ? (point.value / max) * (HEIGHT - PAD_TOP) : 0),
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const peak = points.reduce((best, p) => (p.value > best.value ? p : best), points[0]);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT + 34}`}
      className="chart-svg"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
    >
      <path d={pathD} className="chart-line" fill="none" />
      {points.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r={3.5} className="chart-dot" />
      ))}
      {peak.value > 0 && (
        <text x={peak.x} y={peak.y - 10} textAnchor="middle" className="chart-peak-label">
          {formatValue(peak.value)}
        </text>
      )}
      {points.map((p) => (
        <text key={p.label} x={p.x} y={HEIGHT + 22} textAnchor="middle" className="chart-axis-label">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

// The stacked horizontal status bar in "Payslip Status & Payroll Alerts".
export function StackedBar({
  segments,
}: {
  segments: { key: string; pct: number; className: string }[];
}) {
  return (
    <div className="chart-stack" role="img" aria-label="Payslip status split">
      {segments
        .filter((segment) => segment.pct > 0)
        .map((segment) => (
          <span
            key={segment.key}
            className={`chart-stack__seg ${segment.className}`}
            style={{ width: `${segment.pct}%` }}
          />
        ))}
    </div>
  );
}
