import type { BusinessParameters } from "./types";
import type { FinanceResult } from "./finance";

export interface ScoreDetail {
  label: string;
  score: number; // 0-100
  weight: number; // pondération relative
  comment: string;
}

export interface ModuleScore {
  module: string;
  score: number; // 0-100 agrégé
  rating: Rating;
  details: ScoreDetail[];
  insights: string[]; // points clés / alertes
}

export type Rating = "Excellent" | "Bon" | "Moyen" | "Fragile" | "Critique";

export function ratingFromScore(s: number): Rating {
  if (s >= 80) return "Excellent";
  if (s >= 65) return "Bon";
  if (s >= 50) return "Moyen";
  if (s >= 35) return "Fragile";
  return "Critique";
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function weightedAvg(details: ScoreDetail[]): number {
  const tw = details.reduce((a, d) => a + d.weight, 0);
  if (tw === 0) return 0;
  return details.reduce((a, d) => a + d.score * d.weight, 0) / tw;
}

// --------------------------------------------------------------------------
// 1. MODULE FINANCIER
// --------------------------------------------------------------------------
export function scoreFinancial(
  p: BusinessParameters,
  f: FinanceResult
): ModuleScore {
  const details: ScoreDetail[] = [];

  // Rentabilité via TRI vs taux d'actualisation
  const irr = f.irr ?? -1;
  const irrScore =
    irr === null
      ? 20
      : clamp(50 + ((irr - p.global.discountRate) / 0.2) * 50);
  details.push({
    label: "Rentabilité (TRI)",
    score: irrScore,
    weight: 3,
    comment:
      f.irr === null
        ? "TRI non calculable (flux insuffisants)."
        : `TRI ${(irr * 100).toFixed(1)}% vs taux exigé ${(
            p.global.discountRate * 100
          ).toFixed(1)}%.`,
  });

  // VAN normalisée par l'investissement
  const npvRatio =
    f.totalInvestment > 0 ? f.npv / f.totalInvestment : 0;
  const npvScore = clamp(50 + npvRatio * 60);
  details.push({
    label: "Création de valeur (VAN)",
    score: npvScore,
    weight: 3,
    comment: `VAN ${Math.round(f.npv).toLocaleString("fr-FR")} € (${(
      npvRatio * 100
    ).toFixed(0)}% de l'investissement).`,
  });

  // Délai de retour
  const payback = f.paybackYears;
  const paybackScore =
    payback === null
      ? 10
      : clamp(100 - (payback / p.global.horizonYears) * 90);
  details.push({
    label: "Délai de retour",
    score: paybackScore,
    weight: 2,
    comment:
      payback === null
        ? "Non atteint sur l'horizon."
        : `Retour en ${payback.toFixed(1)} ans.`,
  });

  // Couverture de la dette (DSCR)
  const dscr = f.averageDSCR;
  const dscrScore = isFinite(dscr) ? clamp(((dscr - 1) / 1.0) * 100) : 90;
  details.push({
    label: "Couverture de la dette (DSCR)",
    score: dscrScore,
    weight: 2,
    comment: isFinite(dscr)
      ? `DSCR moyen ${dscr.toFixed(2)} (>1,2 = sain).`
      : "Pas de dette / pas de service à couvrir.",
  });

  // Structure de financement
  const gapScore = f.fundingGap <= 0 ? 100 : clamp(100 - (f.fundingGap / f.totalInvestment) * 150);
  details.push({
    label: "Bouclage du financement",
    score: gapScore,
    weight: 2,
    comment:
      f.fundingGap <= 0
        ? "Plan de financement bouclé."
        : `Déficit de financement de ${Math.round(
            f.fundingGap
          ).toLocaleString("fr-FR")} € à combler.`,
  });

  const insights: string[] = [];
  if (f.fundingGap > 0)
    insights.push(
      `⚠️ Le plan de financement n'est pas bouclé : il manque ${Math.round(
        f.fundingGap
      ).toLocaleString("fr-FR")} €.`
    );
  if (payback === null)
    insights.push("⚠️ L'investissement n'est pas remboursé sur l'horizon analysé.");
  if (isFinite(dscr) && dscr < 1.2)
    insights.push("⚠️ DSCR < 1,2 : la capacité de remboursement est tendue.");
  if (f.irr && f.irr > p.global.discountRate + 0.1)
    insights.push("✅ Rentabilité nettement supérieure au coût du capital.");

  const score = weightedAvg(details);
  return {
    module: "Analyse financière",
    score,
    rating: ratingFromScore(score),
    details,
    insights,
  };
}

// --------------------------------------------------------------------------
// 2. MODULE OPÉRATIONNEL (gestion active / passive)
// --------------------------------------------------------------------------
export function scoreOperational(p: BusinessParameters): ModuleScore {
  const o = p.operations;
  const details: ScoreDetail[] = [];

  // Indice de passivité : moins d'heures dirigeant = plus passif = mieux pour un investisseur passif
  const passivityFromHours = clamp(100 - (o.ownerHoursPerWeek / 60) * 100);
  details.push({
    label: "Faible implication du dirigeant",
    score: passivityFromHours,
    weight: 2,
    comment: `${o.ownerHoursPerWeek} h/semaine du dirigeant.`,
  });

  details.push({
    label: "Automatisation / systématisation",
    score: clamp(o.automationLevel),
    weight: 2,
    comment: `Automatisation à ${o.automationLevel}/100.`,
  });

  details.push({
    label: "Maturité des process (SOP)",
    score: clamp(o.processMaturity),
    weight: 2,
    comment: `Process documentés à ${o.processMaturity}/100.`,
  });

  // Dépendance à l'homme-clé : inverse
  details.push({
    label: "Indépendance à l'homme-clé",
    score: clamp(100 - o.keyManDependency),
    weight: 2,
    comment: `Dépendance personne-clé ${o.keyManDependency}/100.`,
  });

  // Capacité à déléguer (équipe en place)
  const teamScore = clamp(Math.min(o.staffCount, 6) * 16);
  details.push({
    label: "Équipe opérationnelle en place",
    score: teamScore,
    weight: 1,
    comment: `${o.staffCount} employé(s).`,
  });

  const insights: string[] = [];
  const passivityIndex = weightedAvg(details);
  if (o.managementMode === "passive" && passivityIndex < 55)
    insights.push(
      "⚠️ Objectif de gestion passive mais le projet reste très dépendant du dirigeant."
    );
  if (o.keyManDependency > 65)
    insights.push(
      "⚠️ Forte dépendance à une personne clé : risque de continuité et de valorisation."
    );
  if (o.automationLevel > 60 && o.processMaturity > 60)
    insights.push("✅ Bonne base de systématisation : délégation et scalabilité facilitées.");

  return {
    module: "Contraintes opérationnelles",
    score: passivityIndex,
    rating: ratingFromScore(passivityIndex),
    details,
    insights,
  };
}

// --------------------------------------------------------------------------
// 3. MODULE MARCHÉ (réglementaire, barrières, scalabilité, tendances)
// --------------------------------------------------------------------------
export function scoreMarket(p: BusinessParameters): ModuleScore {
  const m = p.market;
  const details: ScoreDetail[] = [];

  details.push({
    label: "Dynamique du marché",
    score: clamp(40 + m.marketGrowthRate * 300),
    weight: 2,
    comment: `Croissance du marché ${(m.marketGrowthRate * 100).toFixed(
      1
    )}%/an, taille ${m.marketSizeM} M€.`,
  });

  details.push({
    label: "Intensité concurrentielle (faible = mieux)",
    score: clamp(100 - m.competitionLevel),
    weight: 1.5,
    comment: `Concurrence ${m.competitionLevel}/100.`,
  });

  details.push({
    label: "Contraintes réglementaires (faible = mieux)",
    score: clamp(100 - m.regulatoryIntensity),
    weight: 1.5,
    comment: `Poids réglementaire ${m.regulatoryIntensity}/100.`,
  });

  details.push({
    label: "Barrières à l'entrée (protègent le projet)",
    score: clamp(m.barriersToEntry),
    weight: 1.5,
    comment: `Barrières ${m.barriersToEntry}/100.`,
  });

  details.push({
    label: "Scalabilité du projet",
    score: clamp(m.scalabilityPotential),
    weight: 2,
    comment: `Potentiel de passage à l'échelle ${m.scalabilityPotential}/100.`,
  });

  // Alignement aux hyper-tendances (projection dans le temps)
  const trendAvg = (m.trendSocietal + m.trendSocial + m.trendEconomic) / 3;
  details.push({
    label: "Alignement aux hyper-tendances",
    score: clamp(trendAvg),
    weight: 2.5,
    comment: `Sociétal ${m.trendSocietal} / Social ${m.trendSocial} / Éco ${m.trendEconomic}.`,
  });

  const insights: string[] = [];
  if (m.regulatoryIntensity > 65)
    insights.push("⚠️ Environnement très réglementé : prévoir un volet conformité robuste.");
  if (m.barriersToEntry < 30)
    insights.push("⚠️ Barrières à l'entrée faibles : avantage concurrentiel peu défendable.");
  if (m.scalabilityPotential > 65)
    insights.push("✅ Fort potentiel de scalabilité.");
  if (trendAvg > 65)
    insights.push("✅ Projet porté par les hyper-tendances de fond.");
  if (m.trendEconomic < 45)
    insights.push("⚠️ Exposition défavorable au cycle économique / pouvoir d'achat.");

  const score = weightedAvg(details);
  return {
    module: "Analyse marché",
    score,
    rating: ratingFromScore(score),
    details,
    insights,
  };
}

// --------------------------------------------------------------------------
// 4. SYNTHÈSE GLOBALE — articule les trois modules
// --------------------------------------------------------------------------
export interface GlobalAnalysis {
  score: number;
  rating: Rating;
  verdict: string;
  modules: { financier: ModuleScore; operationnel: ModuleScore; marche: ModuleScore };
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  weights: { financier: number; operationnel: number; marche: number };
}

export function analyzeGlobal(
  p: BusinessParameters,
  f: FinanceResult
): GlobalAnalysis {
  const financier = scoreFinancial(p, f);
  const operationnel = scoreOperational(p);
  const marche = scoreMarket(p);

  // Pondération : le financier prime, puis marché, puis opérationnel.
  const weights = { financier: 0.45, operationnel: 0.2, marche: 0.35 };
  const score =
    financier.score * weights.financier +
    operationnel.score * weights.operationnel +
    marche.score * weights.marche;

  const rating = ratingFromScore(score);
  const verdict = buildVerdict(rating, score, p);

  // SWOT dérivé des insights
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const opportunities: string[] = [];
  const threats: string[] = [];

  for (const mod of [financier, operationnel, marche]) {
    for (const i of mod.insights) {
      if (i.startsWith("✅")) strengths.push(i.slice(2).trim());
      else weaknesses.push(i.replace(/^⚠️/, "").trim());
    }
  }
  if (p.market.marketGrowthRate > 0.05)
    opportunities.push(
      `Marché en croissance (${(p.market.marketGrowthRate * 100).toFixed(
        0
      )}%/an).`
    );
  if (p.market.scalabilityPotential > 55)
    opportunities.push("Possibilité de réplication / passage à l'échelle.");
  if ((p.market.trendSocietal + p.market.trendSocial) / 2 > 60)
    opportunities.push("Vent porteur des tendances sociétales et sociales.");
  if (p.market.competitionLevel > 60)
    threats.push("Pression concurrentielle élevée.");
  if (p.market.regulatoryIntensity > 60)
    threats.push("Risque réglementaire significatif.");
  if (p.market.trendEconomic < 50)
    threats.push("Sensibilité au cycle économique.");

  return {
    score,
    rating,
    verdict,
    modules: { financier, operationnel, marche },
    swot: { strengths, weaknesses, opportunities, threats },
    weights,
  };
}

function buildVerdict(
  rating: Rating,
  score: number,
  p: BusinessParameters
): string {
  const name = p.identity.projectName;
  switch (rating) {
    case "Excellent":
      return `${name} présente un profil d'investissement très solide (score ${score.toFixed(
        0
      )}/100). Les fondamentaux financiers, opérationnels et de marché sont alignés. Recommandation : aller de l'avant, en sécurisant le financement et l'exécution.`;
    case "Bon":
      return `${name} est un projet attractif (score ${score.toFixed(
        0
      )}/100) avec quelques points de vigilance à adresser avant l'engagement. Recommandation : poursuivre la due diligence sur les zones de fragilité.`;
    case "Moyen":
      return `${name} est viable mais perfectible (score ${score.toFixed(
        0
      )}/100). Plusieurs hypothèses doivent être renforcées. Recommandation : itérer sur les paramètres clés avant décision.`;
    case "Fragile":
      return `${name} présente des fragilités importantes (score ${score.toFixed(
        0
      )}/100). Le couple risque/rendement est défavorable en l'état. Recommandation : revoir le modèle ou le plan de financement.`;
    default:
      return `${name} présente un profil critique (score ${score.toFixed(
        0
      )}/100). En l'état, l'investissement n'est pas recommandé sans refonte substantielle du projet.`;
  }
}
