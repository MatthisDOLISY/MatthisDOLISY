import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { BusinessParameters } from "../engine/types";
import type { FinanceResult } from "../engine/finance";
import type { GlobalAnalysis } from "../engine/scoring";
import { buildBusinessPlan } from "./businessPlan";

// Génère un classeur Excel multi-feuilles : Hypothèses, Business Plan,
// Synthèse financière, Scores. Chaque module a sa feuille dédiée.
export async function exportExcel(
  p: BusinessParameters,
  f: FinanceResult,
  g: GlobalAnalysis,
  overrides: Record<string, number> = {}
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Business Evaluator";
  wb.created = new Date();

  const euro = '#,##0 "€"';
  const pct = "0.0%";

  // --- Feuille Hypothèses ---
  const hyp = wb.addWorksheet("Hypothèses");
  hyp.columns = [
    { header: "Paramètre", key: "k", width: 38 },
    { header: "Valeur", key: "v", width: 24 },
  ];
  const addH = (k: string, v: string | number) => hyp.addRow({ k, v });
  styleHeader(hyp.getRow(1));
  addH("Projet", p.identity.projectName);
  addH("Secteur", p.identity.sector);
  addH("Localisation", p.identity.location);
  addH("Modèle économique", p.identity.businessModel);
  addH("CAPEX (€)", p.investment.capex);
  addH("BFR (€)", p.investment.workingCapital);
  addH("Apport (€)", p.investment.equity);
  addH("Dette (€)", p.investment.debt);
  addH("Taux d'intérêt", p.investment.interestRate);
  addH("Durée emprunt (ans)", p.investment.loanTermYears);
  addH("Horizon (ans)", p.global.horizonYears);
  addH("Taux d'actualisation", p.global.discountRate);
  addH("Taux d'IS", p.global.taxRate);
  addH("Assujetti à la TVA", p.vat.liable ? "Oui" : "Non (franchise en base)");
  addH("Taux de TVA", p.vat.rate);

  // --- Feuille Business Plan ---
  const { years, rows } = buildBusinessPlan(p, f, overrides);
  const bp = wb.addWorksheet("Business Plan");
  const header = ["Poste (€)", ...years.map((y) => `Année ${y}`)];
  bp.addRow(header);
  styleHeader(bp.getRow(1));
  bp.getColumn(1).width = 34;
  years.forEach((_, i) => (bp.getColumn(i + 2).width = 16));

  for (const r of rows) {
    if (r.isHeader) {
      const row = bp.addRow([r.label]);
      row.font = { bold: true, color: { argb: "FFFFFFFF" } };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
      bp.mergeCells(row.number, 1, row.number, years.length + 1);
      continue;
    }
    const row = bp.addRow([r.label, ...r.values]);
    if (r.bold) row.font = { bold: true };
    for (let i = 2; i <= years.length + 1; i++) {
      row.getCell(i).numFmt = euro;
    }
  }

  // --- Feuille Synthèse financière ---
  const synth = wb.addWorksheet("Synthèse financière");
  synth.columns = [
    { header: "Indicateur", key: "k", width: 36 },
    { header: "Valeur", key: "v", width: 22 },
  ];
  styleHeader(synth.getRow(1));
  const sRow = (k: string, v: number, fmt?: string) => {
    const r = synth.addRow({ k, v });
    if (fmt) r.getCell(2).numFmt = fmt;
  };
  sRow("Investissement total", f.totalInvestment, euro);
  sRow("Valeur terminale (actualisée)", f.terminalValue, euro);
  sRow("VAN (incl. valeur terminale)", f.npv, euro);
  if (f.irr !== null) sRow("TRI", f.irr, pct);
  sRow("ROI cumulé", f.roi, pct);
  sRow("Délai de retour (ans)", f.paybackYears ?? 0);
  sRow("Seuil de rentabilité (CA)", f.breakEvenRevenue, euro);
  sRow("DSCR moyen", isFinite(f.averageDSCR) ? f.averageDSCR : 0);
  sRow("Déficit de financement", f.fundingGap, euro);

  // --- Feuille Scores (modules) ---
  const sc = wb.addWorksheet("Scores modules");
  sc.columns = [
    { header: "Module", key: "m", width: 30 },
    { header: "Critère", key: "c", width: 40 },
    { header: "Score /100", key: "s", width: 14 },
    { header: "Commentaire", key: "x", width: 60 },
  ];
  styleHeader(sc.getRow(1));
  const mods = [g.modules.financier, g.modules.operationnel, g.modules.marche];
  for (const mod of mods) {
    const head = sc.addRow({ m: mod.module, c: "SCORE GLOBAL", s: Math.round(mod.score), x: mod.rating });
    head.font = { bold: true };
    for (const d of mod.details) {
      sc.addRow({ m: "", c: d.label, s: Math.round(d.score), x: d.comment });
    }
  }
  sc.addRow({});
  const gr = sc.addRow({ m: "SCORE GLOBAL PROJET", c: "", s: Math.round(g.score), x: g.rating });
  gr.font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `BusinessPlan_${slug(p.identity.projectName)}.xlsx`);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e293b" } };
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .slice(0, 40);
}
