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
  npv: number;
  irr: number | null;
  paybackYears: number | null;
  roi: number; // ROI cumulé sur l'horizon
  breakEvenRevenue: number; // CA annuel de seuil (régime de croisière)
  averageDSCR: number; // couverture du service de la dette
  fundingGap: number; // déficit de financement (capex+BFR - apport - dette)
  contributionMarginPct: number;
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
  const totalInvestment = p.investment.capex + p.investment.workingCapital;
  const fundingGap =
    totalInvestment - p.investment.equity - p.investment.debt;

  const depreciation =
    p.investment.depreciationYears > 0
      ? p.investment.capex / p.investment.depreciationYears
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
    const cogs = revenue * p.costs.cogsPct;
    const grossProfit = revenue - cogs;

    const fixedAnnual =
      (p.costs.rentMonthly +
        p.costs.payrollMonthly +
        p.costs.ownerSalaryMonthly +
        p.costs.otherFixedMonthly) *
      12 *
      inflation;
    const marketing = revenue * p.costs.marketingPctRevenue;
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

  const npv = computeNPV(p.global.discountRate, fcfSeries);
  const irr = computeIRR(fcfSeries);

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
    (p.costs.rentMonthly +
      p.costs.payrollMonthly +
      p.costs.ownerSalaryMonthly +
      p.costs.otherFixedMonthly) *
      12 *
      lastInflation +
    depreciation +
    loan.interest[horizon - 1];
  const contributionMarginPct =
    1 - p.costs.cogsPct - p.costs.marketingPctRevenue;
  const breakEvenRevenue =
    contributionMarginPct > 0 ? fixedCruise / contributionMarginPct : Infinity;

  const averageDSCR = dscrCount > 0 ? dscrSum / dscrCount : Infinity;

  return {
    years,
    totalInvestment,
    npv,
    irr,
    paybackYears,
    roi,
    breakEvenRevenue,
    averageDSCR,
    fundingGap,
    contributionMarginPct,
  };
}
