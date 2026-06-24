import React from "react";
import { useApp } from "../state";
import { Section, Stat, Badge } from "./common";
import { LineChart, BarChart } from "./charts";
import { Comments } from "./Comments";
import { computeFinance } from "../engine/finance";
import { analyzeGlobal, ratingFromScore } from "../engine/scoring";
import { cloneParams } from "../engine/defaults";
import { getByPath, setByPath } from "../lib/paths";
import { fmtEUR, fmtPct, ratingColor } from "../lib/format";
import type { BusinessParameters } from "../engine/types";

interface Metrics {
  npv: number;
  irr: number | null;
  payback: number | null;
  score: number;
}

function metricsFor(p: BusinessParameters): Metrics {
  const f = computeFinance(p);
  const g = analyzeGlobal(p, f);
  return { npv: f.npv, irr: f.irr, payback: f.paybackYears, score: g.score };
}

// Leviers exposés à l'analyse de sensibilité (chemins numériques).
const LEVERS: { path: string; label: string }[] = [
  { path: "revenue.growthRate", label: "Croissance annuelle" },
  { path: "revenue.arpu", label: "Revenu / client (ARPU)" },
  { path: "revenue.pricePerUnit", label: "Prix unitaire" },
  { path: "revenue.customersYear1", label: "Clients année 1" },
  { path: "revenue.unitsYear1", label: "Unités année 1" },
  { path: "costs.cogsPct", label: "Coût des ventes (COGS %)" },
  { path: "costs.rentMonthly", label: "Loyer mensuel" },
  { path: "costs.payrollMonthly", label: "Masse salariale" },
  { path: "investment.capex", label: "CAPEX" },
  { path: "investment.interestRate", label: "Taux d'intérêt" },
  { path: "global.discountRate", label: "Taux d'actualisation" },
];

const STEPS = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3];

// Transforme les hypothèses pour un scénario pessimiste / optimiste.
function applyScenario(base: BusinessParameters, kind: "pess" | "opt"): BusinessParameters {
  const p = cloneParams(base);
  const f = kind === "pess";
  p.revenue.growthRate *= f ? 0.5 : 1.3;
  p.revenue.rampUpYear1 = Math.min(1, p.revenue.rampUpYear1 * (f ? 0.85 : 1.1));
  p.revenue.customersYear1 *= f ? 0.85 : 1.15;
  p.revenue.unitsYear1 *= f ? 0.85 : 1.15;
  p.revenue.arpu *= f ? 0.95 : 1.05;
  p.revenue.pricePerUnit *= f ? 0.95 : 1.05;
  p.revenue.churnRate = Math.min(0.95, p.revenue.churnRate * (f ? 1.3 : 0.8));
  p.costs.cogsPct = Math.min(0.95, p.costs.cogsPct * (f ? 1.08 : 0.95));
  p.costs.payrollMonthly *= f ? 1.05 : 0.98;
  return p;
}

export function SensitivityModule() {
  const { params } = useApp();
  const [lever, setLever] = React.useState("revenue.growthRate");

  // --- Scénarios ---
  const scenarios = React.useMemo(() => {
    const pess = metricsFor(applyScenario(params, "pess"));
    const base = metricsFor(params);
    const opt = metricsFor(applyScenario(params, "opt"));
    return { pess, base, opt };
  }, [params]);

  // --- Sensibilité un facteur ---
  const baseValue = Number(getByPath(params, lever)) || 0;
  const sens = React.useMemo(() => {
    return STEPS.map((step) => {
      const v = baseValue * (1 + step);
      const p = setByPath(params, lever, v);
      const m = metricsFor(p);
      return { step, value: v, ...m };
    });
  }, [params, lever, baseValue]);

  return (
    <div className="module">
      <div className="module-head">
        <h2>🎚️ Sensibilité & scénarios</h2>
      </div>
      <p className="lead">
        Mesurez la robustesse du projet : comparez des scénarios <strong>pessimiste / base / optimiste</strong>
        et testez l'impact de la variation d'un <strong>levier clé</strong> sur la VAN et le score.
      </p>

      <Section title="Scénarios pessimiste / base / optimiste">
        <div className="stat-row">
          <ScenarioCard title="Pessimiste" color="#dc2626" m={scenarios.pess} />
          <ScenarioCard title="Base" color="#2563eb" m={scenarios.base} />
          <ScenarioCard title="Optimiste" color="#16a34a" m={scenarios.opt} />
        </div>
        <BarChart
          formatY={(v) => `${Math.round(v / 1000)}k`}
          data={[
            { label: "Pessimiste", value: scenarios.pess.npv, color: "#dc2626" },
            { label: "Base", value: scenarios.base.npv, color: "#2563eb" },
            { label: "Optimiste", value: scenarios.opt.npv, color: "#16a34a" },
          ]}
        />
        <p className="muted small">VAN par scénario (€). Le scénario pessimiste applique une croissance réduite, un churn et des coûts plus élevés.</p>
      </Section>

      <Section
        title="Analyse de sensibilité (un facteur)"
        right={
          <select value={lever} onChange={(e) => setLever(e.target.value)} className="lever-select">
            {LEVERS.map((l) => (
              <option key={l.path} value={l.path}>{l.label}</option>
            ))}
          </select>
        }
      >
        <LineChart
          labels={STEPS.map((s) => `${s > 0 ? "+" : ""}${Math.round(s * 100)}%`)}
          formatY={(v) => `${Math.round(v / 1000)}k`}
          series={[{ label: "VAN selon le levier", color: "#2563eb", points: sens.map((s) => s.npv) }]}
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Variation</th>
                <th>Valeur du levier</th>
                <th>VAN</th>
                <th>TRI</th>
                <th>Retour</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {sens.map((s) => (
                <tr key={s.step} className={s.step === 0 ? "bold" : ""}>
                  <td>{s.step > 0 ? "+" : ""}{Math.round(s.step * 100)}%</td>
                  <td>{formatLever(lever, s.value)}</td>
                  <td className={s.npv < 0 ? "neg" : ""}>{fmtEUR(s.npv)}</td>
                  <td>{s.irr !== null ? fmtPct(s.irr) : "—"}</td>
                  <td>{s.payback !== null ? `${s.payback.toFixed(1)} ans` : "—"}</td>
                  <td style={{ color: ratingColor(ratingFromScore(s.score)), fontWeight: 700 }}>
                    {Math.round(s.score)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Comments module="global" />
    </div>
  );
}

function ScenarioCard({ title, color, m }: { title: string; color: string; m: Metrics }) {
  return (
    <div className="stat" style={{ borderTop: `3px solid ${color}` }}>
      <div className="stat-value" style={{ color }}>{fmtEUR(m.npv)}</div>
      <div className="stat-label">{title} — VAN</div>
      <div className="stat-hint">
        TRI {m.irr !== null ? fmtPct(m.irr) : "—"} · score {Math.round(m.score)}/100
      </div>
    </div>
  );
}

function formatLever(path: string, v: number): string {
  if (path.includes("Rate") || path.includes("Pct")) return fmtPct(v);
  if (path.includes("capex") || path.includes("rent") || path.includes("payroll") || path.includes("arpu") || path.includes("price"))
    return fmtEUR(v);
  return Math.round(v).toLocaleString("fr-FR");
}
