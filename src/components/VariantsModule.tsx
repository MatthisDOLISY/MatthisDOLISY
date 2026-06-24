import React from "react";
import { useApp } from "../state";
import { Section } from "./common";
import { BarChart } from "./charts";
import { computeFinance } from "../engine/finance";
import { analyzeGlobal, ratingFromScore } from "../engine/scoring";
import { fmtEUR, fmtPct, ratingColor } from "../lib/format";
import type { BusinessParameters } from "../engine/types";

function metricsFor(p: BusinessParameters) {
  const f = computeFinance(p);
  const g = analyzeGlobal(p, f);
  return {
    invest: f.totalInvestment,
    npv: f.npv,
    irr: f.irr,
    payback: f.paybackYears,
    roi: f.roi,
    score: g.score,
    financier: g.modules.financier.score,
    operationnel: g.modules.operationnel.score,
    marche: g.modules.marche.score,
  };
}

export function VariantsModule() {
  const { params, variants, saveVariant, deleteVariant, loadVariant } = useApp();
  const [name, setName] = React.useState("");

  // Colonnes comparées : projet courant + variantes enregistrées.
  const columns = React.useMemo(() => {
    const cur = { id: "__current", name: `${params.identity.projectName} (courant)`, m: metricsFor(params), location: params.identity.location };
    const others = variants.map((v) => ({ id: v.id, name: v.name, m: metricsFor(v.params), location: v.params.identity.location }));
    return [cur, ...others];
  }, [params, variants]);

  function doSave(e: React.FormEvent) {
    e.preventDefault();
    saveVariant(name || params.identity.projectName);
    setName("");
  }

  const rows: { label: string; render: (m: ReturnType<typeof metricsFor>) => React.ReactNode }[] = [
    { label: "Localisation", render: () => null },
    { label: "Investissement", render: (m) => fmtEUR(m.invest) },
    { label: "VAN", render: (m) => <span className={m.npv < 0 ? "neg" : ""}>{fmtEUR(m.npv)}</span> },
    { label: "TRI", render: (m) => (m.irr !== null ? fmtPct(m.irr) : "—") },
    { label: "ROI cumulé", render: (m) => fmtPct(m.roi) },
    { label: "Délai de retour", render: (m) => (m.payback !== null ? `${m.payback.toFixed(1)} ans` : "—") },
    { label: "Score financier", render: (m) => Math.round(m.financier) },
    { label: "Score opérationnel", render: (m) => Math.round(m.operationnel) },
    { label: "Score marché", render: (m) => Math.round(m.marche) },
  ];

  return (
    <div className="module">
      <div className="module-head">
        <h2>🔀 Comparaison de variantes</h2>
      </div>
      <p className="lead">
        Enregistrez plusieurs versions de votre projet (par ex. <em>Lyon</em> vs <em>Bordeaux</em>, ou différents
        montants d'investissement) et comparez-les côte à côte. Les variantes sont sauvegardées dans votre navigateur.
      </p>

      <Section title="Enregistrer la configuration actuelle">
        <form className="variant-save" onSubmit={doSave}>
          <input
            placeholder={`Nom de la variante (ex: ${params.identity.location})`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="primary" type="submit">💾 Enregistrer la variante</button>
        </form>
      </Section>

      <Section title="Tableau comparatif">
        {columns.length <= 1 ? (
          <p className="muted">Aucune variante enregistrée pour l'instant. Ajustez les paramètres puis enregistrez-en une.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Indicateur</th>
                  {columns.map((c) => (
                    <th key={c.id}>
                      <div className="var-col-head">
                        <span>{c.name}</span>
                        <span
                          className="badge"
                          style={{ background: ratingColor(ratingFromScore(c.m.score)), fontSize: 11 }}
                        >
                          {Math.round(c.m.score)}
                        </span>
                        {c.id !== "__current" && (
                          <span className="var-actions">
                            <button className="small" onClick={() => loadVariant(c.id)}>Charger</button>
                            <button className="small" onClick={() => deleteVariant(c.id)}>Suppr.</button>
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className={r.label.startsWith("Score") ? "" : "bold"}>
                    <td>{r.label}</td>
                    {columns.map((c) => (
                      <td key={c.id}>{r.label === "Localisation" ? c.location : r.render(c.m)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {columns.length > 1 && (
        <Section title="VAN par variante">
          <BarChart
            formatY={(v) => `${Math.round(v / 1000)}k`}
            data={columns.map((c, i) => ({
              label: c.name.length > 14 ? c.name.slice(0, 13) + "…" : c.name,
              value: c.m.npv,
              color: i === 0 ? "#1e293b" : "#2563eb",
            }))}
          />
        </Section>
      )}
    </div>
  );
}
