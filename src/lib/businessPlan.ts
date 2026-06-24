import type { BusinessParameters } from "../engine/types";
import type { FinanceResult } from "../engine/finance";

// Construit la matrice du business plan (lignes x années) partagée entre
// l'affichage écran (grille éditable) et l'export Excel.

export interface BPRow {
  label: string;
  key: string;
  values: number[]; // une valeur par année
  isHeader?: boolean;
  bold?: boolean;
  pct?: boolean;
}

export function buildBusinessPlan(
  p: BusinessParameters,
  f: FinanceResult,
  overrides: Record<string, number> = {}
): { years: number[]; rows: BPRow[] } {
  const years = f.years.map((y) => y.year);
  const row = (label: string, key: string, sel: (y: any) => number, opts: Partial<BPRow> = {}): BPRow => ({
    label,
    key,
    values: f.years.map((y, i) => {
      const ov = overrides[`${key}:${i}`];
      return ov !== undefined ? ov : sel(y);
    }),
    ...opts,
  });

  const rows: BPRow[] = [
    { label: "COMPTE DE RÉSULTAT", key: "h-pl", values: years.map(() => NaN), isHeader: true },
    row("Chiffre d'affaires", "revenue", (y) => y.revenue, { bold: true }),
    row("Coût des ventes (COGS)", "cogs", (y) => -y.cogs),
    row("Marge brute", "grossProfit", (y) => y.grossProfit, { bold: true }),
    row("Charges d'exploitation", "opex", (y) => -y.opex),
    row("EBITDA", "ebitda", (y) => y.ebitda, { bold: true }),
    row("Amortissements", "depreciation", (y) => -y.depreciation),
    row("Résultat d'exploitation (EBIT)", "ebit", (y) => y.ebit),
    row("Charges financières", "interest", (y) => -y.interest),
    row("Résultat avant impôt", "ebt", (y) => y.ebt),
    row("Impôt sur les sociétés", "tax", (y) => -y.tax),
    row("Résultat net", "netIncome", (y) => y.netIncome, { bold: true }),
    { label: "TRÉSORERIE", key: "h-cf", values: years.map(() => NaN), isHeader: true },
    row("Free cash-flow", "freeCashFlow", (y) => y.freeCashFlow, { bold: true }),
    row("Cash-flow cumulé", "cumulativeCashFlow", (y) => y.cumulativeCashFlow),
    row("Encours de dette", "debtBalance", (y) => y.debtBalance),
  ];

  return { years, rows };
}
