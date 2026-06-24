import React from "react";
import { useApp } from "../state";
import { Section, Stat, ScoreBar, InsightList, Badge } from "./common";
import { Comments } from "./Comments";

export function OperationalModule() {
  const { global: g, params } = useApp();
  const mod = g.modules.operationnel;
  const o = params.operations;
  return (
    <div className="module">
      <div className="module-head">
        <h2>⚙️ Contraintes opérationnelles</h2>
        <Badge rating={mod.rating} />
      </div>

      <p className="lead">
        Ce module évalue le degré de <strong>gestion active vs passive</strong> : à quel point le projet
        dépend du dirigeant, et sa capacité à tourner de façon autonome (délégation, automatisation, process).
      </p>

      <div className="stat-row">
        <Stat label="Mode de gestion" value={cap(o.managementMode)} />
        <Stat label="Indice de passivité" value={`${Math.round(mod.score)}/100`} hint="100 = totalement passif" />
        <Stat label="Heures dirigeant" value={`${o.ownerHoursPerWeek} h/sem`} />
        <Stat label="Équipe" value={`${o.staffCount} pers.`} />
        <Stat label="Automatisation" value={`${o.automationLevel}/100`} />
        <Stat label="Dépendance homme-clé" value={`${o.keyManDependency}/100`} />
      </div>

      <Section title="Notation détaillée">
        {mod.details.map((d) => (
          <ScoreBar key={d.label} label={d.label} score={d.score} comment={d.comment} />
        ))}
      </Section>

      <Section title="Points clés">
        <InsightList items={mod.insights} />
      </Section>

      <Comments module="operationnel" />
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
