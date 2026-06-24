import React from "react";
import { useApp } from "../state";
import { ScoreGauge, Section, Stat, Badge, ScoreBar } from "./common";
import { Comments } from "./Comments";
import { fmtEUR, fmtPct } from "../lib/format";

export function GlobalDashboard() {
  const { global: g, finance: f, params } = useApp();

  return (
    <div className="module">
      <div className="module-head">
        <h2>🧭 Synthèse globale</h2>
        <Badge rating={g.rating} />
      </div>

      <div className="global-top">
        <ScoreGauge score={g.score} label={g.rating} />
        <div className="verdict">
          <h3>{params.identity.projectName}</h3>
          <p>{g.verdict}</p>
          <div className="stat-row compact">
            <Stat label="VAN" value={fmtEUR(f.npv)} />
            <Stat label="TRI" value={f.irr !== null ? fmtPct(f.irr) : "—"} />
            <Stat label="Investissement" value={fmtEUR(f.totalInvestment)} />
            <Stat label="Retour" value={f.paybackYears !== null ? `${f.paybackYears.toFixed(1)} ans` : "—"} />
          </div>
        </div>
      </div>

      <Section title="Articulation des modules (scores pondérés)">
        <ScoreBar
          label={`Financier — pondération ${Math.round(g.weights.financier * 100)}%`}
          score={g.modules.financier.score}
        />
        <ScoreBar
          label={`Marché — pondération ${Math.round(g.weights.marche * 100)}%`}
          score={g.modules.marche.score}
        />
        <ScoreBar
          label={`Opérationnel — pondération ${Math.round(g.weights.operationnel * 100)}%`}
          score={g.modules.operationnel.score}
        />
      </Section>

      <Section title="Matrice SWOT">
        <div className="swot">
          <div className="swot-cell s">
            <h4>Forces</h4>
            <ul>{g.swot.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
            {!g.swot.strengths.length && <p className="muted">—</p>}
          </div>
          <div className="swot-cell w">
            <h4>Faiblesses</h4>
            <ul>{g.swot.weaknesses.map((x, i) => <li key={i}>{x}</li>)}</ul>
            {!g.swot.weaknesses.length && <p className="muted">—</p>}
          </div>
          <div className="swot-cell o">
            <h4>Opportunités</h4>
            <ul>{g.swot.opportunities.map((x, i) => <li key={i}>{x}</li>)}</ul>
            {!g.swot.opportunities.length && <p className="muted">—</p>}
          </div>
          <div className="swot-cell t">
            <h4>Menaces</h4>
            <ul>{g.swot.threats.map((x, i) => <li key={i}>{x}</li>)}</ul>
            {!g.swot.threats.length && <p className="muted">—</p>}
          </div>
        </div>
      </Section>

      <Comments module="global" />
    </div>
  );
}
