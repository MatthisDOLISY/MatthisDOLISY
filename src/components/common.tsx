import React from "react";
import { ratingColor } from "../lib/format";

export function ScoreGauge({ score, label }: { score: number; label?: string }) {
  const color = ratingColor(ratingOf(score));
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="gauge">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} stroke="#e2e8f0" strokeWidth="12" fill="none" />
        <circle
          cx="70"
          cy="70"
          r={r}
          stroke={color}
          strokeWidth="12"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="66" textAnchor="middle" fontSize="30" fontWeight="700" fill="#0f172a">
          {Math.round(score)}
        </text>
        <text x="70" y="88" textAnchor="middle" fontSize="12" fill="#64748b">
          / 100
        </text>
      </svg>
      {label && <div className="gauge-label" style={{ color }}>{label}</div>}
    </div>
  );
}

function ratingOf(s: number): string {
  if (s >= 80) return "Excellent";
  if (s >= 65) return "Bon";
  if (s >= 50) return "Moyen";
  if (s >= 35) return "Fragile";
  return "Critique";
}

export function ScoreBar({ label, score, comment }: { label: string; score: number; comment?: string }) {
  const color = ratingColor(ratingOf(score));
  return (
    <div className="scorebar">
      <div className="scorebar-head">
        <span className="scorebar-label">{label}</span>
        <span className="scorebar-value" style={{ color }}>{Math.round(score)}</span>
      </div>
      <div className="scorebar-track">
        <div className="scorebar-fill" style={{ width: `${Math.max(2, score)}%`, background: color }} />
      </div>
      {comment && <div className="scorebar-comment">{comment}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function Badge({ rating }: { rating: string }) {
  return (
    <span className="badge" style={{ background: ratingColor(rating) }}>
      {rating}
    </span>
  );
}

export function InsightList({ items }: { items: string[] }) {
  if (!items.length) return <p className="muted">Aucun point saillant détecté.</p>;
  return (
    <ul className="insights">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}
