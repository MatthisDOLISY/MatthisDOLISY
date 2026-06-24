import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import type { BusinessParameters } from "../engine/types";
import type { FinanceResult } from "../engine/finance";
import type { GlobalAnalysis } from "../engine/scoring";
import { fmtEUR, fmtPct, fmtNum } from "./format";

// Génère le document d'investissement Word qui SYNTHÉTISE l'ensemble.
// `narrative` est le texte (éventuellement édité dans l'app ou produit par le LLM)
// qui vient enrichir la synthèse.
export async function exportWord(
  p: BusinessParameters,
  f: FinanceResult,
  g: GlobalAnalysis,
  narrative: string
): Promise<void> {
  const children: (Paragraph | Table)[] = [];

  const h1 = (t: string) =>
    children.push(new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
  const h2 = (t: string) =>
    children.push(new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 80 } }));
  const para = (t: string) =>
    children.push(new Paragraph({ children: [new TextRun(t)], spacing: { after: 80 } }));
  const bullet = (t: string) =>
    children.push(new Paragraph({ text: t, bullet: { level: 0 } }));

  // --- Couverture ---
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 120 },
      children: [new TextRun({ text: "DOCUMENT D'INVESTISSEMENT", bold: true, size: 44 })],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: p.identity.projectName, size: 32, color: "2563eb" })],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [
        new TextRun({ text: `${p.identity.sector} — ${p.identity.location}`, italics: true, size: 24 }),
      ],
    })
  );

  // --- 1. Résumé exécutif ---
  h1("1. Résumé exécutif");
  para(g.verdict);
  children.push(
    new Paragraph({
      spacing: { before: 80, after: 120 },
      children: [
        new TextRun({ text: `Score global : ${g.score.toFixed(0)}/100 — ${g.rating}`, bold: true, size: 26 }),
      ],
    })
  );
  para(p.identity.description);

  // --- 2. Synthèse (narratif éditable / LLM) ---
  if (narrative.trim()) {
    h1("2. Synthèse de l'analyse");
    for (const line of narrative.split("\n")) {
      if (line.trim()) para(line.trim());
    }
  }

  // --- 3. Analyse financière ---
  h1("3. Analyse financière");
  para(
    `L'investissement total s'élève à ${fmtEUR(f.totalInvestment)}, financé par ${fmtEUR(
      p.investment.equity
    )} d'apport et ${fmtEUR(p.investment.debt)} de dette.`
  );
  children.push(
    indicatorsTable([
      ["VAN", fmtEUR(f.npv)],
      ["TRI", f.irr !== null ? fmtPct(f.irr) : "—"],
      ["ROI cumulé", fmtPct(f.roi)],
      ["Délai de retour", f.paybackYears !== null ? `${f.paybackYears.toFixed(1)} ans` : "Non atteint"],
      ["Seuil de rentabilité (CA)", fmtEUR(f.breakEvenRevenue)],
      ["DSCR moyen", isFinite(f.averageDSCR) ? fmtNum(f.averageDSCR, 2) : "—"],
    ])
  );
  for (const i of g.modules.financier.insights) bullet(i);

  // Tableau de projection
  h2("Projection pluriannuelle");
  children.push(projectionTable(f));

  // --- 4. Contraintes opérationnelles ---
  h1("4. Contraintes opérationnelles");
  para(
    `Mode de gestion : ${p.operations.managementMode}. Implication du dirigeant : ${p.operations.ownerHoursPerWeek} h/semaine, ${p.operations.staffCount} employé(s).`
  );
  para(
    `Indice de passivité / délégabilité : ${g.modules.operationnel.score.toFixed(
      0
    )}/100 (${g.modules.operationnel.rating}).`
  );
  for (const i of g.modules.operationnel.insights) bullet(i);

  // --- 5. Analyse marché ---
  h1("5. Analyse marché");
  para(
    `Marché de ${p.market.marketSizeM} M€, croissance ${fmtPct(
      p.market.marketGrowthRate
    )}/an. Réglementation ${p.market.regulatoryIntensity}/100, barrières à l'entrée ${p.market.barriersToEntry}/100, scalabilité ${p.market.scalabilityPotential}/100.`
  );
  para(
    `Alignement aux hyper-tendances — sociétales : ${p.market.trendSocietal}/100, sociales : ${p.market.trendSocial}/100, économiques : ${p.market.trendEconomic}/100.`
  );
  for (const i of g.modules.marche.insights) bullet(i);

  // --- 6. SWOT ---
  h1("6. Synthèse stratégique (SWOT)");
  h2("Forces");
  g.swot.strengths.length ? g.swot.strengths.forEach(bullet) : para("—");
  h2("Faiblesses");
  g.swot.weaknesses.length ? g.swot.weaknesses.forEach(bullet) : para("—");
  h2("Opportunités");
  g.swot.opportunities.length ? g.swot.opportunities.forEach(bullet) : para("—");
  h2("Menaces");
  g.swot.threats.length ? g.swot.threats.forEach(bullet) : para("—");

  // --- 7. Recommandation ---
  h1("7. Recommandation");
  para(g.verdict);

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Investissement_${slug(p.identity.projectName)}.docx`);
}

function cell(text: string, opts: { bold?: boolean; width?: number } = {}): TableCell {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold })] })],
  });
}

function indicatorsTable(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([k, v]) =>
        new TableRow({ children: [cell(k, { bold: true, width: 60 }), cell(v, { width: 40 })] })
    ),
  });
}

function projectionTable(f: FinanceResult): Table {
  const header = new TableRow({
    children: [
      cell("Poste", { bold: true }),
      ...f.years.map((y) => cell(`A${y.year}`, { bold: true })),
    ],
  });
  const line = (label: string, sel: (y: any) => number) =>
    new TableRow({
      children: [cell(label), ...f.years.map((y) => cell(fmtEUR(sel(y))))],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
    },
    rows: [
      header,
      line("Chiffre d'affaires", (y) => y.revenue),
      line("EBITDA", (y) => y.ebitda),
      line("Résultat net", (y) => y.netIncome),
      line("Free cash-flow", (y) => y.freeCashFlow),
      line("Cash-flow cumulé", (y) => y.cumulativeCashFlow),
    ],
  });
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .slice(0, 40);
}
