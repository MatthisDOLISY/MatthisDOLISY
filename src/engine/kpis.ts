import type { BusinessParameters } from "./types";
import type { FinanceResult } from "./finance";
import { fmtEUR, fmtPct, fmtNum } from "../lib/format";

export type BusinessProfile = "recurrent" | "transactionnel" | "patrimonial";

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
  benchmark?: string; // référence / seuil attendu (par type de business)
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

type Dir = "up" | "down";
// Évalue une valeur contre deux seuils (bon / acceptable) et renvoie le ton.
function tone(value: number, good: number, ok: number, dir: Dir): Kpi["tone"] {
  if (!isFinite(value)) return "neutral";
  if (dir === "up") return value >= good ? "good" : value >= ok ? "neutral" : "bad";
  return value <= good ? "good" : value <= ok ? "neutral" : "bad";
}

// Construit les KPI clés (adaptés au type de business) + un résumé d'analyse.
// Les seuils (benchmarks) sont calibrés par profil de business.
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
  const r = p.global.discountRate;

  // Benchmark de marge EBITDA selon le profil.
  const ebitdaBench =
    profile === "recurrent"
      ? { good: 0.25, ok: 0.1, ref: "> 25 % (récurrent)" }
      : profile === "patrimonial"
      ? { good: 0.55, ok: 0.4, ref: "> 55 % (NOI)" }
      : { good: 0.12, ok: 0.05, ref: "> 12 % (commerce)" };

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
      tone: tone(avgEbitdaMargin, ebitdaBench.good, ebitdaBench.ok, "up"),
      benchmark: ebitdaBench.ref,
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
    const marketing1 = first.revenue * p.costs.marketingPctRevenue;
    const cac = marketing1 / Math.max(p.revenue.customersYear1, 1);
    const ltvCac = cac > 0 ? ltv / cac : Infinity;
    const cacPayback = p.revenue.arpu * grossMargin > 0 ? cac / ((p.revenue.arpu * grossMargin) / 12) : Infinity;
    const ruleOf40 = p.revenue.growthRate * 100 + (last.revenue > 0 ? last.ebitda / last.revenue : 0) * 100;

    kpis = [
      { label: "ARR (run-rate année 1)", value: fmtEUR(arr1) },
      { label: "MRR (année 1)", value: fmtEUR(mrr1) },
      { label: "Churn annuel", value: fmtPct(churn), tone: tone(churn, 0.08, 0.2, "down"), benchmark: "< 8 %/an", hint: `rétention ${fmtPct(1 - churn)}` },
      { label: "LTV / client", value: fmtEUR(ltv) },
      { label: "CAC (approx.)", value: fmtEUR(cac), hint: "budget marketing / clients an 1" },
      { label: "Ratio LTV / CAC", value: isFinite(ltvCac) ? `${ltvCac.toFixed(1)}×` : "—", tone: tone(ltvCac, 3, 1, "up"), benchmark: "> 3×" },
      { label: "Payback CAC", value: isFinite(cacPayback) ? `${cacPayback.toFixed(0)} mois` : "—", tone: tone(cacPayback, 12, 18, "down"), benchmark: "< 12 mois" },
      { label: "Rule of 40", value: ruleOf40.toFixed(0), tone: tone(ruleOf40, 40, 25, "up"), benchmark: "≥ 40", hint: "croissance % + marge EBITDA %" },
      { label: "Marge brute", value: fmtPct(grossMargin), tone: tone(grossMargin, 0.75, 0.6, "up"), benchmark: "> 75 % (SaaS)" },
    ];
    narrative = [
      `Modèle récurrent : ARR de départ de ${fmtEUR(arr1)} (${fmtEUR(mrr1)} de MRR), avec un churn annuel de ${fmtPct(churn)} ${churn < 0.08 ? "(excellent)" : churn < 0.2 ? "(correct)" : "(élevé)"}.`,
      isFinite(ltvCac)
        ? `Le ratio LTV/CAC ressort à ${ltvCac.toFixed(1)}× ${ltvCac >= 3 ? "(sain : l'acquisition crée nettement de la valeur ; réf. > 3×)" : ltvCac >= 1 ? "(acceptable mais sous la cible de 3×)" : "(insuffisant : l'acquisition détruit de la valeur en l'état)"}, payback CAC en ${isFinite(cacPayback) ? cacPayback.toFixed(0) + " mois" : "—"}.`
        : "Le coût d'acquisition n'est pas exploitable (budget marketing nul).",
      `Rule of 40 à ${ruleOf40.toFixed(0)} ${ruleOf40 >= 40 ? "— au niveau attendu d'un SaaS performant (réf. ≥ 40)." : "— sous la cible de 40 : arbitrer entre croissance et rentabilité."}`,
      churn > 0.2 ? "⚠️ Le churn élevé pèse sur la valeur vie client : prioriser la rétention." : "La rétention soutient la valeur vie client.",
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
      { label: "Marge brute", value: fmtPct(grossMargin), tone: tone(grossMargin, 0.5, 0.35, "up"), benchmark: "> 50 % (commerce)" },
      { label: "Marge sur coûts variables", value: fmtPct(f.contributionMarginPct), tone: tone(f.contributionMarginPct, 0.35, 0.2, "up"), benchmark: "> 35 %", hint: "après COGS + marketing" },
      { label: "Point mort (CA)", value: fmtEUR(f.breakEvenRevenue), tone: aboveBreakEven ? "good" : "bad", benchmark: "CA croisière > point mort" },
      { label: "Point mort (unités)", value: isFinite(breakEvenUnits) ? fmtNum(breakEvenUnits) : "—", hint: "unités / an" },
    ];
    narrative = [
      `Modèle transactionnel : ticket moyen de ${fmtEUR(ticket)}, marge brute de ${fmtPct(grossMargin)} ${grossMargin >= 0.5 ? "(confortable)" : "(à surveiller)"} et marge sur coûts variables de ${fmtPct(f.contributionMarginPct)}.`,
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
      { label: "Rendement brut", value: fmtPct(grossYield), tone: tone(grossYield, 0.08, 0.06, "up"), benchmark: "> 7-8 %", hint: "revenus / valeur d'actif" },
      { label: "Rendement net", value: fmtPct(netYield), tone: tone(netYield, 0.05, 0.035, "up"), benchmark: "> 4-5 %", hint: "EBITDA / valeur d'actif" },
      { label: "Cash-on-cash (an 1)", value: fmtPct(cashOnCash), tone: tone(cashOnCash, 0.08, 0.04, "up"), benchmark: "> 6-8 %", hint: "FCF / apport" },
      { label: "Effet de levier (LTV)", value: fmtPct(ltvFinancing), tone: tone(ltvFinancing, 0.7, 0.85, "down"), benchmark: "< 80 %", hint: "dette / valeur d'actif" },
      { label: "DSCR moyen", value: isFinite(f.averageDSCR) ? f.averageDSCR.toFixed(2) : "—", tone: tone(f.averageDSCR, 1.25, 1.1, "up"), benchmark: "> 1,25" },
      { label: "Valeur terminale", value: fmtEUR(f.terminalValue), hint: "valeur de revente actualisée" },
    ];
    narrative = [
      `Profil patrimonial à gestion passive : rendement brut de ${fmtPct(grossYield)} (réf. > 7-8 %) et rendement net de ${fmtPct(netYield)} (réf. > 4-5 %) sur la valeur d'actif.`,
      `Le cash-on-cash de la première année ressort à ${fmtPct(cashOnCash)} sur l'apport, avec un effet de levier (LTV) de ${fmtPct(ltvFinancing)} ${ltvFinancing > 0.85 ? "(élevé)" : "(maîtrisé)"}.`,
      isFinite(f.averageDSCR) && f.averageDSCR >= 1.25
        ? `La couverture de la dette est confortable (DSCR ${f.averageDSCR.toFixed(2)}, réf. > 1,25).`
        : `⚠️ La couverture de la dette est tendue (DSCR ${isFinite(f.averageDSCR) ? f.averageDSCR.toFixed(2) : "—"}, réf. > 1,25) : sensibilité aux taux et à la vacance.`,
    ];
  }

  // Note TVA si non assujetti (surcoût) ou ressource de trésorerie significative.
  if (!f.vat.liable) {
    narrative.push(
      `TVA : non assujetti (franchise en base) — la TVA non récupérable sur les charges représente un surcoût d'environ ${fmtEUR(f.vat.nonDeductibleCostYear1)} en année 1.`
    );
  } else if (Math.abs(f.vat.wcImpact) > 1000) {
    narrative.push(
      `TVA : assujetti à ${fmtPct(f.vat.rate)} — le décalage de reversement procure une ressource de trésorerie d'environ ${fmtEUR(-f.vat.wcImpact)} sur le BFR.`
    );
  }

  return { profile, profileLabel, kpis: [...kpis, ...common], narrative };
}
