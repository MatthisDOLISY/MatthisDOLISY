import type { BusinessParameters } from "./types";
import type { FinanceResult } from "./finance";
import { fmtEUR, fmtPct, fmtNum } from "../lib/format";
import { getBenchmarks } from "./benchmarks";

export type BusinessProfile = "recurrent" | "transactionnel" | "patrimonial";

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
  benchmark?: string; // référence / seuil attendu (par sous-secteur)
  tone?: "good" | "bad" | "neutral";
}

export interface FinancialSummary {
  profile: BusinessProfile;
  profileLabel: string;
  benchmarkLabel: string;
  kpis: Kpi[];
  narrative: string[];
}

// Détermine le profil de business à partir des paramètres.
export function detectProfile(p: BusinessParameters): BusinessProfile {
  if (p.operations.managementMode === "passive") return "patrimonial";
  return p.revenue.model === "recurrent" ? "recurrent" : "transactionnel";
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

type Dir = "up" | "down";
// Évalue une valeur contre deux seuils (bon / acceptable) et renvoie le ton.
function tone(value: number, good: number, ok: number, dir: Dir): Kpi["tone"] {
  if (!isFinite(value)) return "neutral";
  if (dir === "up") return value >= good ? "good" : value >= ok ? "neutral" : "bad";
  return value <= good ? "good" : value <= ok ? "neutral" : "bad";
}

// Nombre de clients actifs (run-rate) à l'année i, pour le modèle récurrent.
function customersAt(p: BusinessParameters, i: number): number {
  const retained = 1 - p.revenue.churnRate;
  return p.revenue.customersYear1 * Math.pow(1 + p.revenue.growthRate, i) * (i === 0 ? 1 : retained);
}

// CAC affiné : coût d'acquisition mélangé sur l'horizon, rapporté aux clients
// NOUVELLEMENT acquis chaque année (croissance nette + remplacement du churn),
// et non à la seule base de l'année 1.
function refinedCac(p: BusinessParameters, f: FinanceResult): { cac: number; totalNewAdds: number } {
  const retained = 1 - p.revenue.churnRate;
  let totalMarketing = 0;
  let totalNewAdds = 0;
  for (let i = 0; i < f.years.length; i++) {
    const base = customersAt(p, i);
    const prevRetained = i === 0 ? 0 : customersAt(p, i - 1) * retained;
    const newAdds = Math.max(0, base - prevRetained); // bruts : croissance + remplacement du churn
    totalNewAdds += newAdds;
    totalMarketing += f.years[i].revenue * p.costs.marketingPctRevenue;
  }
  const cac = totalNewAdds > 0 ? totalMarketing / totalNewAdds : Infinity;
  return { cac, totalNewAdds };
}

// Construit les KPI clés (adaptés au sous-secteur) + un résumé d'analyse.
export function buildFinancialSummary(
  p: BusinessParameters,
  f: FinanceResult
): FinancialSummary {
  const profile = detectProfile(p);
  const b = getBenchmarks(p);
  const last = f.years[f.years.length - 1];
  const first = f.years[0];
  const grossMargin = 1 - p.costs.cogsPct;
  const ebitdaMargins = f.years.map((y) => (y.revenue > 0 ? y.ebitda / y.revenue : 0));
  const avgEbitdaMargin = avg(ebitdaMargins);
  const r = p.global.discountRate;

  const common: Kpi[] = [
    { label: "VAN", value: fmtEUR(f.npv), tone: f.npv >= 0 ? "good" : "bad", benchmark: "> 0", hint: "incl. valeur terminale" },
    {
      label: "TRI",
      value: f.irr !== null ? fmtPct(f.irr) : "—",
      tone: f.irr !== null ? tone(f.irr, r + 0.08, r, "up") : "bad",
      benchmark: `> ${fmtPct(r)} (coût du capital)`,
    },
    {
      label: "Délai de retour",
      value: f.paybackYears !== null ? `${f.paybackYears.toFixed(1)} ans` : "Non atteint",
      tone: f.paybackYears !== null ? tone(f.paybackYears, p.global.horizonYears / 2, p.global.horizonYears, "down") : "bad",
      benchmark: `< ${(p.global.horizonYears / 2).toFixed(0)} ans`,
    },
    {
      label: "Marge EBITDA moyenne",
      value: fmtPct(avgEbitdaMargin),
      tone: tone(avgEbitdaMargin, b.ebitdaMargin.good, b.ebitdaMargin.ok, "up"),
      benchmark: b.ebitdaMargin.ref,
    },
  ];

  let kpis: Kpi[] = [];
  let narrative: string[] = [];
  let profileLabel = "";

  if (profile === "recurrent") {
    profileLabel = "Business récurrent (abonnement)";
    const arr1 = p.revenue.customersYear1 * p.revenue.arpu;
    const mrr1 = arr1 / 12;
    const churn = p.revenue.churnRate;
    const ltv = (p.revenue.arpu * grossMargin) / Math.max(churn, 0.02);
    const { cac, totalNewAdds } = refinedCac(p, f);
    const ltvCac = cac > 0 && isFinite(cac) ? ltv / cac : Infinity;
    const cacPayback = p.revenue.arpu * grossMargin > 0 && isFinite(cac) ? cac / ((p.revenue.arpu * grossMargin) / 12) : Infinity;
    const ruleOf40 = p.revenue.growthRate * 100 + (last.revenue > 0 ? last.ebitda / last.revenue : 0) * 100;

    kpis = [
      { label: "ARR (run-rate année 1)", value: fmtEUR(arr1) },
      { label: "MRR (année 1)", value: fmtEUR(mrr1) },
      { label: "Churn annuel", value: fmtPct(churn), tone: b.churn && tone(churn, b.churn.good, b.churn.ok, "down"), benchmark: b.churn?.ref, hint: `rétention ${fmtPct(1 - churn)}` },
      { label: "LTV / client", value: fmtEUR(ltv) },
      { label: "CAC affiné", value: isFinite(cac) ? fmtEUR(cac) : "—", hint: `${fmtNum(totalNewAdds)} clients acquis / ${p.global.horizonYears} ans` },
      { label: "Ratio LTV / CAC", value: isFinite(ltvCac) ? `${ltvCac.toFixed(1)}×` : "—", tone: b.ltvCac && tone(ltvCac, b.ltvCac.good, b.ltvCac.ok, "up"), benchmark: b.ltvCac?.ref },
      { label: "Payback CAC", value: isFinite(cacPayback) ? `${cacPayback.toFixed(0)} mois` : "—", tone: b.cacPaybackMonths && tone(cacPayback, b.cacPaybackMonths.good, b.cacPaybackMonths.ok, "down"), benchmark: b.cacPaybackMonths?.ref },
      { label: "Rule of 40", value: ruleOf40.toFixed(0), tone: b.ruleOf40 && tone(ruleOf40, b.ruleOf40.good, b.ruleOf40.ok, "up"), benchmark: b.ruleOf40?.ref, hint: "croissance % + marge EBITDA %" },
      { label: "Marge brute", value: fmtPct(grossMargin), tone: tone(grossMargin, b.grossMargin.good, b.grossMargin.ok, "up"), benchmark: b.grossMargin.ref },
    ];
    narrative = [
      `Modèle récurrent : ARR de départ de ${fmtEUR(arr1)} (${fmtEUR(mrr1)} de MRR), churn annuel de ${fmtPct(churn)} (réf. ${b.churn?.ref}).`,
      isFinite(ltvCac)
        ? `CAC affiné de ${fmtEUR(cac)} (sur ${fmtNum(totalNewAdds)} clients acquis sur l'horizon) → ratio LTV/CAC de ${ltvCac.toFixed(1)}× ${ltvCac >= (b.ltvCac?.good ?? 3) ? `(sain, réf. ${b.ltvCac?.ref})` : ltvCac >= (b.ltvCac?.ok ?? 1) ? "(acceptable, sous la cible)" : "(insuffisant : l'acquisition détruit de la valeur)"}, payback CAC ${isFinite(cacPayback) ? cacPayback.toFixed(0) + " mois" : "—"}.`
        : "Le coût d'acquisition n'est pas exploitable (budget marketing nul).",
      `Rule of 40 à ${ruleOf40.toFixed(0)} (réf. ${b.ruleOf40?.ref}) ${ruleOf40 >= (b.ruleOf40?.good ?? 40) ? "— équilibre croissance/rentabilité au niveau attendu." : "— sous la cible : arbitrer croissance vs rentabilité."}`,
      churn > (b.churn?.ok ?? 0.2) ? "⚠️ Churn élevé pour le secteur : prioriser la rétention." : "La rétention est cohérente avec les standards du secteur.",
    ];
  } else if (profile === "transactionnel") {
    profileLabel = "Business transactionnel (volume × prix)";
    const ticket = p.revenue.pricePerUnit;
    const breakEvenUnits = ticket > 0 ? f.breakEvenRevenue / ticket : Infinity;
    const aboveBreakEven = last.revenue > f.breakEvenRevenue;
    kpis = [
      { label: "Panier / ticket moyen", value: fmtEUR(ticket) },
      { label: "Volume année 1", value: fmtNum(p.revenue.unitsYear1), hint: "unités" },
      { label: "CA de croisière", value: fmtEUR(last.revenue) },
      { label: "Marge brute", value: fmtPct(grossMargin), tone: tone(grossMargin, b.grossMargin.good, b.grossMargin.ok, "up"), benchmark: b.grossMargin.ref },
      { label: "Marge sur coûts variables", value: fmtPct(f.contributionMarginPct), tone: b.contributionMargin && tone(f.contributionMarginPct, b.contributionMargin.good, b.contributionMargin.ok, "up"), benchmark: b.contributionMargin?.ref, hint: "après COGS + marketing" },
      { label: "Point mort (CA)", value: fmtEUR(f.breakEvenRevenue), tone: aboveBreakEven ? "good" : "bad", benchmark: "CA croisière > point mort" },
      { label: "Point mort (unités)", value: isFinite(breakEvenUnits) ? fmtNum(breakEvenUnits) : "—", hint: "unités / an" },
    ];
    narrative = [
      `Modèle transactionnel : ticket moyen de ${fmtEUR(ticket)}, marge brute de ${fmtPct(grossMargin)} (réf. ${b.grossMargin.ref}) et marge sur coûts variables de ${fmtPct(f.contributionMarginPct)}.`,
      `Le point mort se situe à ${fmtEUR(f.breakEvenRevenue)} de chiffre d'affaires${isFinite(breakEvenUnits) ? ` (soit ~${fmtNum(breakEvenUnits)} unités/an)` : ""}.`,
      aboveBreakEven
        ? `Le CA de croisière (${fmtEUR(last.revenue)}) dépasse le point mort de ${fmtPct(last.revenue / f.breakEvenRevenue - 1)} : marge de sécurité confortable.`
        : `⚠️ Le CA de croisière (${fmtEUR(last.revenue)}) reste sous le point mort : revoir volumes, prix ou charges fixes.`,
    ];
  } else {
    profileLabel = "Business patrimonial (gestion passive)";
    const assetValue = p.investment.capex || 1;
    const grossYield = first.revenue / assetValue;
    const netYield = first.ebitda / assetValue;
    const cashOnCash = p.investment.equity > 0 ? first.freeCashFlow / p.investment.equity : 0;
    const ltvFinancing = p.investment.debt / assetValue;
    kpis = [
      { label: "Rendement brut", value: fmtPct(grossYield), tone: b.grossYield && tone(grossYield, b.grossYield.good, b.grossYield.ok, "up"), benchmark: b.grossYield?.ref, hint: "revenus / valeur d'actif" },
      { label: "Rendement net", value: fmtPct(netYield), tone: b.netYield && tone(netYield, b.netYield.good, b.netYield.ok, "up"), benchmark: b.netYield?.ref, hint: "EBITDA / valeur d'actif" },
      { label: "Cash-on-cash (an 1)", value: fmtPct(cashOnCash), tone: b.cashOnCash && tone(cashOnCash, b.cashOnCash.good, b.cashOnCash.ok, "up"), benchmark: b.cashOnCash?.ref, hint: "FCF / apport" },
      { label: "Effet de levier (LTV)", value: fmtPct(ltvFinancing), tone: b.ltv && tone(ltvFinancing, b.ltv.good, b.ltv.ok, "down"), benchmark: b.ltv?.ref, hint: "dette / valeur d'actif" },
      { label: "DSCR moyen", value: isFinite(f.averageDSCR) ? f.averageDSCR.toFixed(2) : "—", tone: b.dscr && tone(f.averageDSCR, b.dscr.good, b.dscr.ok, "up"), benchmark: b.dscr?.ref },
      { label: "Valeur terminale", value: fmtEUR(f.terminalValue), hint: "valeur de revente actualisée" },
    ];
    narrative = [
      `Profil patrimonial à gestion passive : rendement brut de ${fmtPct(grossYield)} (réf. ${b.grossYield?.ref}) et rendement net de ${fmtPct(netYield)} (réf. ${b.netYield?.ref}) sur la valeur d'actif.`,
      `Cash-on-cash de la première année de ${fmtPct(cashOnCash)} sur l'apport (réf. ${b.cashOnCash?.ref}), effet de levier (LTV) de ${fmtPct(ltvFinancing)} (réf. ${b.ltv?.ref}).`,
      isFinite(f.averageDSCR) && b.dscr && f.averageDSCR >= b.dscr.good
        ? `La couverture de la dette est confortable (DSCR ${f.averageDSCR.toFixed(2)}, réf. ${b.dscr.ref}).`
        : `⚠️ La couverture de la dette est tendue (DSCR ${isFinite(f.averageDSCR) ? f.averageDSCR.toFixed(2) : "—"}, réf. ${b.dscr?.ref}) : sensibilité aux taux et à la vacance.`,
    ];
  }

  if (!f.vat.liable) {
    narrative.push(
      `TVA : non assujetti (franchise en base) — la TVA non récupérable sur les charges représente un surcoût d'environ ${fmtEUR(f.vat.nonDeductibleCostYear1)} en année 1.`
    );
  } else if (Math.abs(f.vat.wcImpact) > 1000) {
    narrative.push(
      `TVA : assujetti à ${fmtPct(f.vat.rate)} — le décalage de reversement procure une ressource de trésorerie d'environ ${fmtEUR(-f.vat.wcImpact)} sur le BFR.`
    );
  }

  return { profile, profileLabel, benchmarkLabel: b.label, kpis: [...kpis, ...common], narrative };
}
