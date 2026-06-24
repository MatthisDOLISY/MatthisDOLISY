import type { BusinessParameters } from "./types";

export interface YearLine {
  year: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  interest: number;
  ebt: number;
  tax: number;
  netIncome: number;
  freeCashFlow: number;
  cumulativeCashFlow: number;
  debtBalance: number;
}

export interface FinanceResult {
  years: YearLine[];
  totalInvestment: number;
  terminalValue: number; // valeur terminale (revente / valeur de continuation) actualisée incluse dans la VAN
  npv: number;
  irr: number | null;
  paybackYears: number | null;
  roi: number; // ROI cumulé sur l'horizon
  breakEvenRevenue: number; // CA annuel de seuil (régime de croisière)
  averageDSCR: number; // couverture du service de la dette
  fundingGap: number; // déficit de financement (capex+BFR - apport - dette)
  contributionMarginPct: number;
  vat: {
    liable: boolean;
    rate: number;
    collectedYear1: number; // TVA collectée sur ventes (année 1)
    deductibleYear1: number; // TVA déductible sur achats (année 1)
    netDueYear1: number; // TVA nette à reverser (année 1)
    wcImpact: number; // impact sur le BFR (négatif = ressource de trésorerie)
    nonDeductibleCostYear1: number; // surcoût de TVA non récupérable si non assujetti (année 1)
  };
}

// ---- Revenu par année selon le modèle ----
function revenueForYear(p: BusinessParameters, yearIndex: number): number {
  const r = p.revenue;
  const rampFactor = yearIndex === 0 ? r.rampUpYear1 : 1;
  const growth = Math.pow(1 + r.growthRate, yearIndex);
  if (r.model === "recurrent") {
    // base clients croît, nette de churn appliqué à la croissance
    const retained = 1 - r.churnRate;
    const effectiveGrowth = Math.pow(1 + r.growthRate, yearIndex);
    const customers =
      r.customersYear1 * effectiveGrowth * (yearIndex === 0 ? 1 : retained);
    return customers * r.arpu * rampFactor;
  }
  return r.unitsYear1 * r.pricePerUnit * growth * rampFactor;
}

// ---- Échéancier d'emprunt (annuités constantes) ----
function loanSchedule(
  principal: number,
  rate: number,
  termYears: number,
  years: number
): { interest: number[]; principalPaid: number[]; balance: number[] } {
  const interest: number[] = [];
  const principalPaid: number[] = [];
  const balance: number[] = [];
  if (principal <= 0 || termYears <= 0) {
    for (let i = 0; i < years; i++) {
      interest.push(0);
      principalPaid.push(0);
      balance.push(0);
    }
    return { interest, principalPaid, balance };
  }
  const annuity =
    rate > 0
      ? (principal * rate) / (1 - Math.pow(1 + rate, -termYears))
      : principal / termYears;
  let bal = principal;
  for (let i = 0; i < years; i++) {
    if (i < termYears && bal > 0.01) {
      const int = bal * rate;
      const princ = Math.min(annuity - int, bal);
      bal -= princ;
      interest.push(int);
      principalPaid.push(princ);
    } else {
      interest.push(0);
      principalPaid.push(0);
    }
    balance.push(Math.max(0, bal));
  }
  return { interest, principalPaid, balance };
}

// ---- VAN ----
export function computeNPV(rate: number, cashflows: number[]): number {
  return cashflows.reduce(
    (acc, cf, t) => acc + cf / Math.pow(1 + rate, t),
    0
  );
}

// ---- TRI par bissection (robuste) ----
export function computeIRR(cashflows: number[]): number | null {
  const npvAt = (r: number) => computeNPV(r, cashflows);
  // Pas de signe alterné -> pas de TRI exploitable
  const hasNeg = cashflows.some((c) => c < 0);
  const hasPos = cashflows.some((c) => c > 0);
  if (!hasNeg || !hasPos) return null;

  let low = -0.9;
  let high = 5;
  let fLow = npvAt(low);
  let fHigh = npvAt(high);
  if (fLow * fHigh > 0) return null; // pas de racine dans l'intervalle

  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const fMid = npvAt(mid);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLow * fMid < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }
  return (low + high) / 2;
}

export function computeFinance(p: BusinessParameters): FinanceResult {
  const horizon = Math.max(1, Math.round(p.global.horizonYears));

  // --- TVA ---
  // Hypothèse : tous les montants saisis sont HORS TAXES (HT).
  // Si l'entreprise n'est PAS assujettie (franchise en base), la TVA sur les
  // achats taxables n'est pas récupérable : elle devient un surcoût réel.
  const vatRate = p.vat.rate;
  // Facteur appliqué aux charges d'exploitation portant de la TVA (achats, loyer,
  // marketing, autres). On considère la TVA sur l'investissement comme neutre
  // (récupérable si assujetti ; non applicable pour l'immobilier ancien, étalée sinon).
  const vatCostFactor = p.vat.liable ? 1 : 1 + vatRate;

  const effectiveCapex = p.investment.capex;
  const totalInvestmentBase = effectiveCapex + p.investment.workingCapital;

  // Impact de la TVA sur le BFR (régime assujetti) : la TVA collectée sur les
  // ventes est encaissée puis reversée avec un décalage → ressource de trésorerie
  // (BFR négatif). Calculé sur l'année 1.
  const rev1 = revenueForYear(p, 0);
  const vatCollectedY1 = p.vat.liable ? rev1 * vatRate : 0;
  const vatDeductibleBaseY1 =
    rev1 * p.costs.cogsPct +
    rev1 * p.costs.marketingPctRevenue +
    (p.costs.rentMonthly + p.costs.otherFixedMonthly) * 12;
  const vatDeductibleY1 = p.vat.liable ? vatDeductibleBaseY1 * vatRate : 0;
  const vatNetDueY1 = vatCollectedY1 - vatDeductibleY1;
  const vatWcImpact = p.vat.liable
    ? -(vatNetDueY1 / 12) * p.vat.lagMonths
    : 0;
  const nonDeductibleCostY1 = p.vat.liable ? 0 : vatDeductibleBaseY1 * vatRate;

  const totalInvestment = totalInvestmentBase + vatWcImpact;
  const fundingGap =
    totalInvestment - p.investment.equity - p.investment.debt;

  const depreciation =
    p.investment.depreciationYears > 0
      ? effectiveCapex / p.investment.depreciationYears
      : 0;

  const loan = loanSchedule(
    p.investment.debt,
    p.investment.interestRate,
    p.investment.loanTermYears,
    horizon
  );

  const years: YearLine[] = [];
  const fcfSeries: number[] = [-totalInvestment]; // t=0 : décaissement initial
  let cumulative = -totalInvestment;
  let dscrSum = 0;
  let dscrCount = 0;

  for (let i = 0; i < horizon; i++) {
    const inflation = Math.pow(1 + p.costs.inflationRate, i);
    const revenue = revenueForYear(p, i);
    // COGS portent de la TVA : surcoût si non assujetti.
    const cogs = revenue * p.costs.cogsPct * vatCostFactor;
    const grossProfit = revenue - cogs;

    // Loyer, autres charges et marketing portent de la TVA ; salaires non.
    const fixedAnnual =
      ((p.costs.rentMonthly + p.costs.otherFixedMonthly) * vatCostFactor +
        p.costs.payrollMonthly +
        p.costs.ownerSalaryMonthly) *
      12 *
      inflation;
    const marketing = revenue * p.costs.marketingPctRevenue * vatCostFactor;
    const opex = fixedAnnual + marketing;

    const ebitda = grossProfit - opex;
    const dep = i < p.investment.depreciationYears ? depreciation : 0;
    const ebit = ebitda - dep;
    const interest = loan.interest[i];
    const ebt = ebit - interest;
    const tax = ebt > 0 ? ebt * p.global.taxRate : 0;
    const netIncome = ebt - tax;

    // Free cash flow (entreprise) = EBITDA - impôt - variation BFR - remboursement capital
    const principal = loan.principalPaid[i];
    const fcf = ebitda - tax - principal;
    cumulative += fcf;
    fcfSeries.push(ebitda - tax); // pour VAN/TRI projet on prend les flux d'exploitation après impôt

    // DSCR = (EBITDA - impôt) / (intérêt + capital)
    const debtService = interest + principal;
    if (debtService > 0) {
      dscrSum += (ebitda - tax) / debtService;
      dscrCount++;
    }

    years.push({
      year: i + 1,
      revenue,
      cogs,
      grossProfit,
      opex,
      ebitda,
      depreciation: dep,
      ebit,
      interest,
      ebt,
      tax,
      netIncome,
      freeCashFlow: fcf,
      cumulativeCashFlow: cumulative,
      debtBalance: loan.balance[i],
    });
  }

  // Valeur terminale : on capitalise le flux d'exploitation normatif de la
  // dernière année (EBITDA - impôt) selon le modèle de Gordon-Shapiro.
  // C'est ce qui représente la revente / la valeur de continuation au-delà de l'horizon.
  const lastNormCF = fcfSeries[fcfSeries.length - 1]; // EBITDA - impôt de la dernière année
  const g = Math.min(p.global.perpetualGrowthRate, p.global.discountRate - 0.005);
  const terminalUndiscounted =
    p.global.discountRate > g && lastNormCF > 0
      ? (lastNormCF * (1 + g)) / (p.global.discountRate - g)
      : 0;
  const terminalValue =
    terminalUndiscounted / Math.pow(1 + p.global.discountRate, horizon);

  // Flux pour la valorisation : on ajoute la valeur terminale à la dernière année.
  const valuationFlows = [...fcfSeries];
  valuationFlows[valuationFlows.length - 1] += terminalUndiscounted;

  const npv = computeNPV(p.global.discountRate, valuationFlows);
  const irr = computeIRR(valuationFlows);

  // Payback : première année où le cumul (hors financement) repasse positif
  let paybackYears: number | null = null;
  let run = -totalInvestment;
  for (let i = 0; i < years.length; i++) {
    const prev = run;
    run += fcfSeries[i + 1];
    if (prev < 0 && run >= 0) {
      const frac = prev !== run ? -prev / (run - prev) : 0;
      paybackYears = i + frac;
      break;
    }
  }

  const totalNetIncome = years.reduce((a, y) => a + y.netIncome, 0);
  const roi = totalInvestment > 0 ? totalNetIncome / totalInvestment : 0;

  // Seuil de rentabilité en régime de croisière (dernière année)
  const lastInflation = Math.pow(1 + p.costs.inflationRate, horizon - 1);
  const fixedCruise =
    ((p.costs.rentMonthly + p.costs.otherFixedMonthly) * vatCostFactor +
      p.costs.payrollMonthly +
      p.costs.ownerSalaryMonthly) *
      12 *
      lastInflation +
    depreciation +
    loan.interest[horizon - 1];
  const contributionMarginPct =
    1 - (p.costs.cogsPct + p.costs.marketingPctRevenue) * vatCostFactor;
  const breakEvenRevenue =
    contributionMarginPct > 0 ? fixedCruise / contributionMarginPct : Infinity;

  const averageDSCR = dscrCount > 0 ? dscrSum / dscrCount : Infinity;

  return {
    years,
    totalInvestment,
    terminalValue,
    npv,
    irr,
    paybackYears,
    roi,
    breakEvenRevenue,
    averageDSCR,
    fundingGap,
    contributionMarginPct,
    vat: {
      liable: p.vat.liable,
      rate: vatRate,
      collectedYear1: vatCollectedY1,
      deductibleYear1: vatDeductibleY1,
      netDueYear1: vatNetDueY1,
      wcImpact: vatWcImpact,
      nonDeductibleCostYear1: nonDeductibleCostY1,
    },
  };
}
