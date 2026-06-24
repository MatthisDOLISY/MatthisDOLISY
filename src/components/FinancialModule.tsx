import React from "react";
import { useApp } from "../state";
import { Section, Stat, ScoreBar, InsightList, Badge } from "./common";
import { Comments } from "./Comments";
import { LineChart } from "./charts";
import { buildFinancialSummary } from "../engine/kpis";
import { fmtEUR, fmtPct, fmtNum } from "../lib/format";

export function FinancialModule() {
  const { finance: f, global: g, params } = useApp();
  const mod = g.modules.financier;
  const summary = buildFinancialSummary(params, f);
  return (
    <div className="module">
      <div className="module-head">
        <h2>💰 Analyse financière</h2>
        <Badge rating={mod.rating} />
      </div>

      <Section
        title="Résumé d'analyse & indicateurs clés"
        right={<span className="profile-tag">{summary.profileLabel}</span>}
      >
        <ul className="insights">
          {summary.narrative.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
        <div className="kpi-grid">
          {summary.kpis.map((k) => (
            <div key={k.label} className={`kpi kpi-${k.tone ?? "neutral"}`}>
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-label">{k.label}</div>
              {k.hint && <div className="kpi-hint">{k.hint}</div>}
            </div>
          ))}
        </div>
      </Section>

      <div className="stat-row">
        <Stat label="Investissement total" value={fmtEUR(f.totalInvestment)} />
        <Stat label="VAN" value={fmtEUR(f.npv)} hint={`incl. valeur terminale`} />
        <Stat label="Valeur terminale (actualisée)" value={fmtEUR(f.terminalValue)} hint={`croissance perpét. ${fmtPct(params.global.perpetualGrowthRate)}`} />
        <Stat label="TRI" value={f.irr !== null ? fmtPct(f.irr) : "—"} />
        <Stat label="ROI cumulé" value={fmtPct(f.roi)} />
        <Stat label="Délai de retour" value={f.paybackYears !== null ? `${f.paybackYears.toFixed(1)} ans` : "Non atteint"} />
        <Stat label="DSCR moyen" value={isFinite(f.averageDSCR) ? fmtNum(f.averageDSCR, 2) : "—"} />
        <Stat label="Seuil de rentabilité" value={fmtEUR(f.breakEvenRevenue)} hint="CA de croisière" />
        <Stat label="Bouclage financement" value={f.fundingGap <= 0 ? "OK" : fmtEUR(-f.fundingGap)} />
        <Stat
          label={f.vat.liable ? `TVA nette à reverser (an 1)` : "Surcoût TVA non récup. (an 1)"}
          value={f.vat.liable ? fmtEUR(f.vat.netDueYear1) : fmtEUR(f.vat.nonDeductibleCostYear1)}
          hint={f.vat.liable ? `assujetti ${fmtPct(f.vat.rate)}` : "franchise en base"}
        />
      </div>

      <Section title="Notation détaillée">
        {mod.details.map((d) => (
          <ScoreBar key={d.label} label={d.label} score={d.score} comment={d.comment} />
        ))}
      </Section>

      <Section title="Points clés">
        <InsightList items={mod.insights} />
      </Section>

      <Section title="Trajectoire financière">
        <LineChart
          labels={f.years.map((y) => `A${y.year}`)}
          formatY={(v) => `${Math.round(v / 1000)}k`}
          series={[
            { label: "Chiffre d'affaires", color: "#2563eb", points: f.years.map((y) => y.revenue) },
            { label: "EBITDA", color: "#16a34a", points: f.years.map((y) => y.ebitda) },
            { label: "Résultat net", color: "#ca8a04", points: f.years.map((y) => y.netIncome) },
            { label: "Cash-flow cumulé", color: "#dc2626", points: f.years.map((y) => y.cumulativeCashFlow) },
          ]}
        />
      </Section>

      <Section title="Projection financière">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Poste</th>
                {f.years.map((y) => (
                  <th key={y.year}>Année {y.year}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Chiffre d'affaires" vals={f.years.map((y) => y.revenue)} bold />
              <Row label="EBITDA" vals={f.years.map((y) => y.ebitda)} />
              <Row label="Résultat net" vals={f.years.map((y) => y.netIncome)} />
              <Row label="Free cash-flow" vals={f.years.map((y) => y.freeCashFlow)} />
              <Row label="Cash-flow cumulé" vals={f.years.map((y) => y.cumulativeCashFlow)} bold />
            </tbody>
          </table>
        </div>
      </Section>

      <Comments module="financier" />
    </div>
  );
}

function Row({ label, vals, bold }: { label: string; vals: number[]; bold?: boolean }) {
  return (
    <tr className={bold ? "bold" : ""}>
      <td>{label}</td>
      {vals.map((v, i) => (
        <td key={i} className={v < 0 ? "neg" : ""}>{fmtEUR(v)}</td>
      ))}
    </tr>
  );
}
