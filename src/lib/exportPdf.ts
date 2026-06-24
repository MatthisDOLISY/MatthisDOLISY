import type { BusinessParameters } from "../engine/types";
import type { FinanceResult } from "../engine/finance";
import type { GlobalAnalysis } from "../engine/scoring";
import { buildFinancialSummary } from "../engine/kpis";
import { fmtEUR, fmtPct, fmtNum, ratingColor } from "./format";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const toneColor: Record<string, string> = {
  good: "#16a34a",
  bad: "#dc2626",
  neutral: "#64748b",
};

// Génère le document d'investissement en PDF via l'impression du navigateur
// (sans dépendance externe) : typographie nette, texte sélectionnable.
export function exportPdf(
  p: BusinessParameters,
  f: FinanceResult,
  g: GlobalAnalysis,
  narrative: string
): void {
  const s = buildFinancialSummary(p, f);

  const kpiRows = s.kpis
    .map(
      (k) => `<tr>
        <td>${esc(k.label)}${k.hint ? `<span class="hint"> — ${esc(k.hint)}</span>` : ""}</td>
        <td class="val" style="color:${toneColor[k.tone ?? "neutral"]}">${esc(k.value)}</td>
        <td class="ref">${k.benchmark ? esc(k.benchmark) : ""}</td>
      </tr>`
    )
    .join("");

  const valuationRows: [string, string][] = [
    ["Investissement total", fmtEUR(f.totalInvestment)],
    ["Valeur terminale (actualisée)", fmtEUR(f.terminalValue)],
    ["VAN (incl. valeur terminale)", fmtEUR(f.npv)],
    ["TRI", f.irr !== null ? fmtPct(f.irr) : "—"],
    ["ROI cumulé", fmtPct(f.roi)],
    ["Délai de retour", f.paybackYears !== null ? `${f.paybackYears.toFixed(1)} ans` : "Non atteint"],
    ["Seuil de rentabilité (CA)", fmtEUR(f.breakEvenRevenue)],
    ["DSCR moyen", isFinite(f.averageDSCR) ? fmtNum(f.averageDSCR, 2) : "—"],
    ["TVA", f.vat.liable ? `Assujetti (${fmtPct(f.vat.rate)})` : "Franchise en base (non assujetti)"],
  ];

  const projHead = `<th></th>${f.years.map((y) => `<th>Année ${y.year}</th>`).join("")}`;
  const projRow = (label: string, sel: (y: any) => number) =>
    `<tr><td>${label}</td>${f.years.map((y) => `<td class="num">${fmtEUR(sel(y))}</td>`).join("")}</tr>`;

  const swotCell = (title: string, items: string[], cls: string) =>
    `<div class="swot ${cls}"><h4>${title}</h4>${
      items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "<p>—</p>"
    }</div>`;

  const insightsList = (items: string[]) =>
    items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "<p>—</p>";

  const narrativeHtml = narrative.trim()
    ? narrative
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => `<p>${esc(l.trim())}</p>`)
        .join("")
    : "";

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Document d'investissement — ${esc(p.identity.projectName)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11pt; line-height: 1.5; margin: 0; }
  h1 { font-size: 16pt; color: #1e293b; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin: 22px 0 10px; page-break-after: avoid; }
  h2 { font-size: 12.5pt; color: #334155; margin: 16px 0 6px; page-break-after: avoid; }
  p { margin: 0 0 6px; }
  ul { margin: 0 0 8px; padding-left: 18px; }
  li { margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 10pt; page-break-inside: auto; }
  th, td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; }
  th { background: #f1f5f9; font-weight: 700; }
  td.val { text-align: right; font-weight: 700; white-space: nowrap; }
  td.num { text-align: right; white-space: nowrap; }
  td.ref { color: #64748b; font-size: 9pt; }
  .hint { color: #94a3b8; font-weight: 400; font-size: 9pt; }
  .cover { text-align: center; padding: 60px 0 30px; }
  .cover .doctype { font-size: 22pt; font-weight: 800; letter-spacing: 1px; }
  .cover .project { font-size: 18pt; color: #2563eb; margin: 10px 0; }
  .cover .sub { font-style: italic; color: #64748b; }
  .scorebox { display: inline-block; margin-top: 18px; padding: 10px 22px; border-radius: 10px; color: #fff; font-weight: 800; font-size: 14pt; }
  .swot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .swot { border-radius: 8px; padding: 8px 10px; page-break-inside: avoid; }
  .swot h4 { margin: 0 0 4px; font-size: 10.5pt; }
  .swot.s { background: #f0fdf4; border: 1px solid #bbf7d0; }
  .swot.w { background: #fef2f2; border: 1px solid #fecaca; }
  .swot.o { background: #eff6ff; border: 1px solid #bfdbfe; }
  .swot.t { background: #fff7ed; border: 1px solid #fed7aa; }
  .profile { display:inline-block; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; padding:2px 10px; border-radius:999px; font-size:9.5pt; font-weight:700; }
  section { page-break-inside: avoid; }
</style></head>
<body>
  <div class="cover">
    <div class="doctype">DOCUMENT D'INVESTISSEMENT</div>
    <div class="project">${esc(p.identity.projectName)}</div>
    <div class="sub">${esc(p.identity.sector)} — ${esc(p.identity.location)}</div>
    <div class="scorebox" style="background:${ratingColor(g.rating)}">Score global ${g.score.toFixed(0)}/100 — ${g.rating}</div>
  </div>

  <h1>1. Résumé exécutif</h1>
  <p>${esc(g.verdict)}</p>
  <p>${esc(p.identity.description)}</p>

  ${narrativeHtml ? `<h1>2. Synthèse de l'analyse</h1>${narrativeHtml}` : ""}

  <h1>3. Analyse financière</h1>
  <p>L'investissement total s'élève à ${fmtEUR(f.totalInvestment)}, financé par ${fmtEUR(p.investment.equity)} d'apport et ${fmtEUR(p.investment.debt)} de dette.</p>
  <h2>Résumé d'analyse — <span class="profile">${esc(s.profileLabel)}</span></h2>
  ${insightsList(s.narrative)}
  <h2>Indicateurs clés (avec benchmarks)</h2>
  <table><thead><tr><th>Indicateur</th><th class="val">Valeur</th><th>Référence</th></tr></thead><tbody>${kpiRows}</tbody></table>
  <h2>Indicateurs de valorisation</h2>
  <table><tbody>${valuationRows.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="val">${esc(v)}</td></tr>`).join("")}</tbody></table>
  <h2>Projection pluriannuelle</h2>
  <table><thead><tr>${projHead}</tr></thead><tbody>
    ${projRow("Chiffre d'affaires", (y) => y.revenue)}
    ${projRow("EBITDA", (y) => y.ebitda)}
    ${projRow("Résultat net", (y) => y.netIncome)}
    ${projRow("Free cash-flow", (y) => y.freeCashFlow)}
    ${projRow("Cash-flow cumulé", (y) => y.cumulativeCashFlow)}
  </tbody></table>

  <h1>4. Contraintes opérationnelles</h1>
  <p>Mode de gestion : ${esc(p.operations.managementMode)}. Implication du dirigeant : ${p.operations.ownerHoursPerWeek} h/semaine, ${p.operations.staffCount} employé(s). Indice de passivité / délégabilité : ${g.modules.operationnel.score.toFixed(0)}/100 (${g.modules.operationnel.rating}).</p>
  ${insightsList(g.modules.operationnel.insights)}

  <h1>5. Analyse marché</h1>
  <p>Marché de ${p.market.marketSizeM} M€, croissance ${fmtPct(p.market.marketGrowthRate)}/an. Réglementation ${p.market.regulatoryIntensity}/100, barrières à l'entrée ${p.market.barriersToEntry}/100, scalabilité ${p.market.scalabilityPotential}/100.</p>
  <p>Alignement aux hyper-tendances — sociétales : ${p.market.trendSocietal}/100, sociales : ${p.market.trendSocial}/100, économiques : ${p.market.trendEconomic}/100.</p>
  ${insightsList(g.modules.marche.insights)}

  <h1>6. Synthèse stratégique (SWOT)</h1>
  <div class="swot-grid">
    ${swotCell("Forces", g.swot.strengths, "s")}
    ${swotCell("Faiblesses", g.swot.weaknesses, "w")}
    ${swotCell("Opportunités", g.swot.opportunities, "o")}
    ${swotCell("Menaces", g.swot.threats, "t")}
  </div>

  <h1>7. Recommandation</h1>
  <p>${esc(g.verdict)}</p>

  <script>
    window.onload = function () { setTimeout(function () { window.print(); }, 250); };
    window.onafterprint = function () { window.close(); };
  </script>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert(
      "Le navigateur a bloqué la fenêtre d'impression PDF. Autorisez les pop-ups pour ce site, puis réessayez."
    );
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
