import React from "react";
import { useApp } from "../state";
import { Section, Stat, ScoreBar, InsightList, Badge } from "./common";
import { Comments } from "./Comments";
import { fmtPct } from "../lib/format";

export function MarketModule() {
  const { global: g, params } = useApp();
  const mod = g.modules.marche;
  const m = params.market;

  // Projection simple de la taille de marché sur l'horizon
  const horizon = params.global.horizonYears;
  const projected = m.marketSizeM * Math.pow(1 + m.marketGrowthRate, horizon);

  return (
    <div className="module">
      <div className="module-head">
        <h2>🌍 Analyse marché</h2>
        <Badge rating={mod.rating} />
      </div>

      <p className="lead">
        Contraintes réglementaires, barrières à l'entrée, scalabilité et projection du projet au regard
        des <strong>hyper-tendances</strong> sociétales, sociales et économiques.
      </p>

      <div className="stat-row">
        <Stat label="Taille de marché" value={`${m.marketSizeM} M€`} />
        <Stat label="Croissance marché" value={fmtPct(m.marketGrowthRate) + "/an"} />
        <Stat label={`Marché projeté à ${horizon} ans`} value={`${projected.toFixed(0)} M€`} />
        <Stat label="Réglementation" value={`${m.regulatoryIntensity}/100`} hint="poids des contraintes" />
        <Stat label="Barrières à l'entrée" value={`${m.barriersToEntry}/100`} />
        <Stat label="Scalabilité" value={`${m.scalabilityPotential}/100`} />
      </div>

      <Section title="Alignement aux hyper-tendances">
        <ScoreBar label="Tendances sociétales (valeurs, durabilité…)" score={m.trendSocietal} />
        <ScoreBar label="Tendances sociales (modes de vie, démographie…)" score={m.trendSocial} />
        <ScoreBar label="Tendances économiques (pouvoir d'achat, taux…)" score={m.trendEconomic} />
      </Section>

      <Section title="Notation détaillée">
        {mod.details.map((d) => (
          <ScoreBar key={d.label} label={d.label} score={d.score} comment={d.comment} />
        ))}
      </Section>

      <Section title="Points clés">
        <InsightList items={mod.insights} />
      </Section>

      <Comments module="marche" />
    </div>
  );
}
