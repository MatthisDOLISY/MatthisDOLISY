import React from "react";

export interface Series {
  label: string;
  color: string;
  points: number[];
}

// ---- Graphique en courbes (multi-séries) ----
export function LineChart({
  series,
  labels,
  height = 240,
  formatY,
}: {
  series: Series[];
  labels: string[];
  height?: number;
  formatY?: (n: number) => string;
}) {
  const W = 560;
  const H = height;
  const pad = { l: 64, r: 16, t: 16, b: 28 };
  const all = series.flatMap((s) => s.points);
  let min = Math.min(0, ...all);
  let max = Math.max(0, ...all);
  if (min === max) max = min + 1;
  const n = labels.length;
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, n - 1);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);

  const ticks = 4;
  const gridY = Array.from({ length: ticks + 1 }, (_, i) => min + ((max - min) * i) / ticks);
  const fmt = formatY ?? ((v: number) => Math.round(v).toLocaleString("fr-FR"));

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
        {gridY.map((g, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="#eef2f7" />
            <text x={pad.l - 8} y={y(g) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {fmt(g)}
            </text>
          </g>
        ))}
        {y(0) > pad.t && y(0) < H - pad.b && (
          <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#cbd5e1" />
        )}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b">
            {l}
          </text>
        ))}
        {series.map((s) => (
          <g key={s.label}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              points={s.points.map((p, i) => `${x(i)},${y(p)}`).join(" ")}
            />
            {s.points.map((p, i) => (
              <circle key={i} cx={x(i)} cy={y(p)} r="3" fill={s.color} />
            ))}
          </g>
        ))}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Graphique en barres ----
export function BarChart({
  data,
  height = 220,
  formatY,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  formatY?: (n: number) => string;
}) {
  const W = 560;
  const H = height;
  const pad = { l: 64, r: 16, t: 16, b: 36 };
  const vals = data.map((d) => d.value);
  let min = Math.min(0, ...vals);
  let max = Math.max(0, ...vals);
  if (min === max) max = min + 1;
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const fmt = formatY ?? ((v: number) => Math.round(v).toLocaleString("fr-FR"));
  const zeroY = y(0);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
        <line x1={pad.l} x2={W - pad.r} y1={zeroY} y2={zeroY} stroke="#cbd5e1" />
        {data.map((d, i) => {
          const cx = pad.l + i * bw + bw / 2;
          const top = d.value >= 0 ? y(d.value) : zeroY;
          const h = Math.abs(zeroY - y(d.value));
          return (
            <g key={i}>
              <rect x={cx - bw * 0.3} y={top} width={bw * 0.6} height={Math.max(1, h)} rx="3" fill={d.color ?? "#2563eb"} />
              <text x={cx} y={H - 20} textAnchor="middle" fontSize="10" fill="#64748b">
                {d.label}
              </text>
              <text x={cx} y={top - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f172a">
                {fmt(d.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---- Radar (axes 0-100) ----
export function RadarChart({
  axes,
  height = 260,
}: {
  axes: { label: string; value: number }[];
  height?: number;
}) {
  const S = height;
  const cx = S / 2;
  const cy = S / 2;
  const R = S / 2 - 46;
  const n = axes.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, r: number) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
  const rings = [25, 50, 75, 100];

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${S} ${S}`} width="100%" height={S} role="img">
        {rings.map((rr) => (
          <polygon
            key={rr}
            fill="none"
            stroke="#e2e8f0"
            points={axes.map((_, i) => pt(i, (rr / 100) * R).join(",")).join(" ")}
          />
        ))}
        {axes.map((_, i) => {
          const [ex, ey] = pt(i, R);
          return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke="#e2e8f0" />;
        })}
        <polygon
          fill="rgba(37,99,235,0.18)"
          stroke="#2563eb"
          strokeWidth="2"
          points={axes.map((a, i) => pt(i, (Math.max(0, Math.min(100, a.value)) / 100) * R).join(",")).join(" ")}
        />
        {axes.map((a, i) => {
          const [lx, ly] = pt(i, R + 18);
          return (
            <text key={i} x={lx} y={ly} textAnchor="middle" fontSize="10" fill="#475569">
              {a.label} ({Math.round(a.value)})
            </text>
          );
        })}
      </svg>
    </div>
  );
}
