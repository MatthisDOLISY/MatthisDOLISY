import type { BusinessParameters } from "./types";
import type { FinanceResult } from "./finance";
import { fmtEUR, fmtPct, fmtNum } from "../lib/format";

export type BusinessProfile = "recurrent" | "transactionnel" | "patrimonial";

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad" | "neutral";
}

export interface FinancialSummary {
  profile: BusinessProfile;
  profileLabel: string;
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

// Construit les KPI clés (adaptés au type de business) + un résumé d'analyse.
export function buildFinancialSummary(
  p: BusinessParameters,
  f: FinanceResult
): FinancialSummary {
  const profile = detectProfile(p);
  const last = f.years[f.years.length - 1];
  const first = f.years[0];
  const grossMargin = 1 - p.costs.cogsPct;
  const ebitdaMargins = f.years.map((y) => (y.revenue > 0 ? y.ebitda / y.revenue : 0));
  const avgEbitdaMargin = avg(ebitdaMargins);

  const common: Kpi[] = [
    { label: "VAN", value: fmtEUR(f.npv), tone: f.npv >= 0 ? "good" : "bad", hint: "incl. valeur terminale" },
    { label: "TRI", value: f.irr !== null ? fmtPct(f.irr) : "—", tone: f.irr !== null && f.irr > p.global.discountRate ? "good" : "bad" },
    { label: "Délai de retour", value: f.paybackYears !== null ? `${f.paybackYears.toFixed(1)} ans` : "Non atteint", tone: f.paybackYears !== null ? "good" : "bad" },
    { label: "Marge EBITDA moyenne", value: fmtPct(avgEbitdaMargin), tone: avgEbitdaMargin > 0.15 ? "good" : avgEbitdaMargin > 0 ? "neutral" : "bad" },
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
    const marketing1 = first.revenue * p.costs.marketingPctRevenue;
    const cac = marketing1 / Math.max(p.revenue.customersYear1, 1);
    const ltvCac = cac > 0 ? ltv / cac : Infinity;
    const cacPayback = (p.revenue.arpu * grossMargin) > 0 ? cac / ((p.revenue.arpu * grossMargin) / 12) : Infinity;
    const ruleOf40 = p.revenue.growthRate * 100 + (last.revenue > 0 ? last.ebitda / last.revenue : 0) * 100;

    kpis = [
      { label: "ARR (run-rate année 1)", value: fmtEUR(arr1) },
      { label: "MRR (année 1)", value: fmtEUR(mrr1) },
      { label: "Churn annuel", value: fmtPct(churn), tone: churn < 0.1 ? "good" : churn < 0.25 ? "neutral" : "bad", hint: `rétention ${fmtPct(1 - churn)}` },
      { label: "LTV / client", value: fmtEUR(ltv) },
      { label: "CAC (approx.)", value: fmtEUR(cac), hint: "budget marketing / clients an 1" },
      { label: "Ratio LTV / CAC", value: isFinite(ltvCac) ? `${ltvCac.toFixed(1)}×` : "—", tone: ltvCac >= 3 ? "good" : ltvCac >= 1 ? "neutral" : "bad", hint: "> 3 = sain" },
      { label: "Payback CAC", value: isFinite(cacPayback) ? `${cacPayback.toFixed(0)} mois` : "—", tone: cacPayback <= 12 ? "good" : cacPayback <= 24 ? "neutral" : "bad" },
      { label: "Rule of 40", value: ruleOf40.toFixed(0), tone: ruleOf40 >= 40 ? "good" : "neutral", hint: "croissance % + marge EBITDA %" },
      { label: "Marge brute", value: fmtPct(grossMargin), tone: grossMargin > 0.7 ? "good" : "neutral" },
    ];
    narrative = [
      `Modèle récurrent : ARR de départ de ${fmtEUR(arr1)} (${fmtEUR(mrr1)} de MRR), avec un churn annuel de ${fmtPct(churn)}.`,
      isFinite(ltvCac)
        ? `Le ratio LTV/CAC ressort à ${ltvCac.toFixed(1)}× ${ltvCac >= 3 ? "(sain : l'acquisition crée nettement de la valeur)" : ltvCac >= 1 ? "(acceptable mais à améliorer)" : "(insuffisant : l'acquisition détruit de la valeur en l'état)"}.`
        : "Le coût d'acquisition n'est pas exploitable (budget marketing nul).",
      `Rule of 40 à ${ruleOf40.toFixed(0)} ${ruleOf40 >= 40 ? "— équilibre croissance/rentabilité au niveau attendu d'un SaaS performant." : "— marge de progression sur le couple croissance/rentabilité."}`,
      churn > 0.25 ? "⚠️ Le churn élevé pèse sur la valeur vie client : prioriser la rétention." : "La rétention soutient la valeur vie client.",
    ];
  } else if (profile === "transactionnel") {
    profileLabel = "Business transactionnel (volume × prix)";
    const ticket = p.revenue.pricePerUnit;
    const breakEvenUnits = ticket > 0 ? f.breakEvenRevenue / ticket : Infinity;
    kpis = [
      { label: "Panier / ticket moyen", value: fmtEUR(ticket) },
      { label: "Volume année 1", value: fmtNum(p.revenue.unitsYear1), hint: "unités" },
      { label: "CA de croisière", value: fmtEUR(last.revenue) },
      { label: "Marge brute", value: fmtPct(grossMargin), tone: grossMargin > 0.5 ? "good" : "neutral" },
      { label: "Marge sur coûts variables", value: fmtPct(f.contributionMarginPct), hint: "après COGS + marketing" },
      { label: "Point mort (CA)", value: fmtEUR(f.breakEvenRevenue), tone: last.revenue > f.breakEvenRevenue ? "good" : "bad" },
      { label: "Point mort (unités)", value: isFinite(breakEvenUnits) ? fmtNum(breakEvenUnits) : "—", hint: "unités / an" },
    ];
    narrative = [
      `Modèle transactionnel : ticket moyen de ${fmtEUR(ticket)}, marge brute de ${fmtPct(grossMargin)} et marge sur coûts variables de ${fmtPct(f.contributionMarginPct)}.`,
      `Le point mort se situe à ${fmtEUR(f.breakEvenRevenue)} de chiffre d'affaires${isFinite(breakEvenUnits) ? ` (soit ~${fmtNum(breakEvenUnits)} unités/an)` : ""}.`,
      last.revenue > f.breakEvenRevenue
        ? `Le CA de croisière (${fmtEUR(last.revenue)}) dépasse le point mort : le modèle est rentable à terme.`
        : `⚠️ Le CA de croisière (${fmtEUR(last.revenue)}) reste sous le point mort : revoir les volumes, les prix ou les charges fixes.`,
    ];
  } else {
    profileLabel = "Business patrimonial (gestion passive)";
    const assetValue = p.investment.capex || 1;
    const grossYield = first.revenue / assetValue;
    const netYield = first.ebitda / assetValue;
    const cashOnCash = p.investment.equity > 0 ? first.freeCashFlow / p.investment.equity : 0;
    const ltvFinancing = p.investment.debt / assetValue;
    kpis = [
      { label: "Rendement brut", value: fmtPct(grossYield), tone: grossYield > 0.07 ? "good" : "neutral", hint: "revenus / valeur d'actif" },
      { label: "Rendement net", value: fmtPct(netYield), tone: netYield > 0.04 ? "good" : "neutral", hint: "EBITDA / valeur d'actif" },
      { label: "Cash-on-cash (an 1)", value: fmtPct(cashOnCash), tone: cashOnCash > 0.05 ? "good" : cashOnCash > 0 ? "neutral" : "bad", hint: "FCF / apport" },
      { label: "Effet de levier (LTV)", value: fmtPct(ltvFinancing), hint: "dette / valeur d'actif" },
      { label: "DSCR moyen", value: isFinite(f.averageDSCR) ? f.averageDSCR.toFixed(2) : "—", tone: f.averageDSCR >= 1.2 ? "good" : "bad", hint: "> 1,2 = sain" },
      { label: "Valeur terminale", value: fmtEUR(f.terminalValue), hint: "valeur de revente actualisée" },
    ];
    narrative = [
      `Profil patrimonial à gestion passive : rendement brut de ${fmtPct(grossYield)} et rendement net de ${fmtPct(netYield)} sur la valeur d'actif.`,
      `Le cash-on-cash de la première année ressort à ${fmtPct(cashOnCash)} sur l'apport, avec un effet de levier (LTV) de ${fmtPct(ltvFinancing)}.`,
      isFinite(f.averageDSCR) && f.averageDSCR >= 1.2
        ? `La couverture de la dette est confortable (DSCR ${f.averageDSCR.toFixed(2)}).`
        : `⚠️ La couverture de la dette est tendue (DSCR ${isFinite(f.averageDSCR) ? f.averageDSCR.toFixed(2) : "—"}) : sensibilité aux taux et à la vacance.`,
    ];
  }

  // Note TVA si non assujetti (surcoût) ou ressource de trésorerie significative.
  if (!f.vat.liable) {
    narrative.push(
      `TVA : non assujetti (franchise en base) — la TVA non récupérable représente un surcoût d'environ ${fmtEUR(f.vat.nonDeductibleCostYear1)} en année 1.`
    );
  } else if (Math.abs(f.vat.wcImpact) > 1000) {
    narrative.push(
      `TVA : assujetti à ${fmtPct(f.vat.rate)} — le décalage de reversement procure une ressource de trésorerie d'environ ${fmtEUR(-f.vat.wcImpact)} sur le BFR.`
    );
  }

  return { profile, profileLabel, kpis: [...kpis, ...common], narrative };
}
