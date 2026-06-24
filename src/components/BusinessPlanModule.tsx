import React from "react";
import { useApp } from "../state";
import { buildBusinessPlan } from "../lib/businessPlan";
import { exportExcel } from "../lib/exportExcel";
import { Comments } from "./Comments";
import { fmtEUR } from "../lib/format";

export function BusinessPlanModule() {
  const { params, finance, global, bpOverrides, setOverride, clearOverrides } = useApp();
  const { years, rows } = buildBusinessPlan(params, finance, bpOverrides);
  const [busy, setBusy] = React.useState(false);

  async function download() {
    setBusy(true);
    try {
      await exportExcel(params, finance, global, bpOverrides);
    } catch (e) {
      alert("Erreur export Excel : " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const overrideCount = Object.keys(bpOverrides).length;

  return (
    <div className="module">
      <div className="module-head">
        <h2>📊 Business Plan (Excel)</h2>
        <div className="actions">
          {overrideCount > 0 && (
            <button className="ghost" onClick={clearOverrides}>
              Réinitialiser {overrideCount} cellule(s)
            </button>
          )}
          <button className="primary" onClick={download} disabled={busy}>
            {busy ? "Génération…" : "⬇️ Exporter en .xlsx"}
          </button>
        </div>
      </div>

      <p className="lead">
        Livrable <strong>business plan</strong> recalculé en direct depuis vos hypothèses. Vous pouvez aussi
        <strong> éditer une cellule</strong> directement (double-clic) pour forcer une valeur ; l'export Excel
        reprend vos modifications. Les cellules forcées apparaissent en bleu.
      </p>

      <div className="table-wrap">
        <table className="data-table editable">
          <thead>
            <tr>
              <th>Poste (€)</th>
              {years.map((y) => (
                <th key={y}>Année {y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              if (r.isHeader) {
                return (
                  <tr key={r.key} className="section-row">
                    <td colSpan={years.length + 1}>{r.label}</td>
                  </tr>
                );
              }
              return (
                <tr key={r.key} className={r.bold ? "bold" : ""}>
                  <td>{r.label}</td>
                  {r.values.map((v, i) => {
                    const k = `${r.key}:${i}`;
                    const isOverride = bpOverrides[k] !== undefined;
                    return (
                      <EditableCell
                        key={i}
                        value={v}
                        override={isOverride}
                        onCommit={(nv) => setOverride(k, nv)}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Comments module="business-plan" />
    </div>
  );
}

function EditableCell({
  value,
  override,
  onCommit,
}: {
  value: number;
  override: boolean;
  onCommit: (v: number | null) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  function start() {
    setDraft(String(Math.round(value)));
    setEditing(true);
  }
  function commit() {
    setEditing(false);
    const n = parseFloat(draft.replace(/\s/g, "").replace(",", "."));
    onCommit(Number.isNaN(n) ? null : n);
  }

  if (editing) {
    return (
      <td>
        <input
          autoFocus
          className="cell-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </td>
    );
  }
  return (
    <td
      className={`${value < 0 ? "neg" : ""} ${override ? "override" : ""}`}
      onDoubleClick={start}
      title="Double-cliquez pour forcer une valeur"
    >
      {fmtEUR(value)}
    </td>
  );
}
