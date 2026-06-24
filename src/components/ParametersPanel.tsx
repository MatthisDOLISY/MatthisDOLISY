import React from "react";
import { useApp } from "../state";
import { sectorPresets } from "../engine/sectors";

interface FieldProps {
  label: string;
  path: string;
  value: number | string;
  type?: "number" | "text" | "pct" | "select";
  options?: { value: string; label: string }[];
  step?: number;
  suffix?: string;
}

function Field({ label, path, value, type = "number", options, step, suffix }: FieldProps) {
  const { updateParam } = useApp();
  if (type === "select") {
    return (
      <label className="field">
        <span>{label}</span>
        <select value={value as string} onChange={(e) => updateParam(path, e.target.value)}>
          {options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    );
  }
  if (type === "pct") {
    return (
      <label className="field">
        <span>{label}</span>
        <div className="field-input">
          <input
            type="number"
            step={step ?? 1}
            value={Math.round((value as number) * 1000) / 10}
            onChange={(e) => updateParam(path, (parseFloat(e.target.value) || 0) / 100)}
          />
          <em>%</em>
        </div>
      </label>
    );
  }
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-input">
        <input
          type={type}
          step={step}
          value={value}
          onChange={(e) => updateParam(path, type === "number" ? e.target.value : e.target.value)}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="param-group" open>
      <summary>{title}</summary>
      <div className="param-grid">{children}</div>
    </details>
  );
}

export function ParametersPanel() {
  const { params, resetParams, loadParams } = useApp();
  const p = params;

  function pickSector(id: string) {
    const preset = sectorPresets.find((s) => s.id === id);
    if (preset) loadParams(preset.build());
  }

  return (
    <aside className="params">
      <div className="params-head">
        <h2>Paramètres du projet</h2>
        <button className="ghost" onClick={resetParams}>Réinitialiser</button>
      </div>
      <p className="muted small">
        Modifiez n'importe quelle hypothèse : tous les modules et livrables se recalculent instantanément.
      </p>

      <label className="field sector-picker">
        <span>📦 Charger un modèle de secteur</span>
        <select defaultValue="" onChange={(e) => { pickSector(e.target.value); e.target.value = ""; }}>
          <option value="" disabled>Choisir un secteur…</option>
          {sectorPresets.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </label>

      <Group title="🪪 Identité">
        <Field label="Nom du projet" path="identity.projectName" value={p.identity.projectName} type="text" />
        <Field label="Secteur" path="identity.sector" value={p.identity.sector} type="text" />
        <Field label="Localisation" path="identity.location" value={p.identity.location} type="text" />
        <Field label="Modèle économique" path="identity.businessModel" value={p.identity.businessModel} type="text" />
      </Group>

      <Group title="💰 Investissement & financement">
        <Field label="CAPEX" path="investment.capex" value={p.investment.capex} suffix="€" />
        <Field label="BFR" path="investment.workingCapital" value={p.investment.workingCapital} suffix="€" />
        <Field label="Amortissement" path="investment.depreciationYears" value={p.investment.depreciationYears} suffix="ans" />
        <Field label="Apport (capitaux propres)" path="investment.equity" value={p.investment.equity} suffix="€" />
        <Field label="Dette / emprunt" path="investment.debt" value={p.investment.debt} suffix="€" />
        <Field label="Taux d'intérêt" path="investment.interestRate" value={p.investment.interestRate} type="pct" step={0.1} />
        <Field label="Durée emprunt" path="investment.loanTermYears" value={p.investment.loanTermYears} suffix="ans" />
      </Group>

      <Group title="📈 Revenus">
        <Field
          label="Modèle de revenu"
          path="revenue.model"
          value={p.revenue.model}
          type="select"
          options={[
            { value: "recurrent", label: "Récurrent (abonnés)" },
            { value: "unitaire", label: "Unitaire (volume × prix)" },
          ]}
        />
        {p.revenue.model === "recurrent" ? (
          <>
            <Field label="Clients année 1" path="revenue.customersYear1" value={p.revenue.customersYear1} />
            <Field label="Revenu / client / an (ARPU)" path="revenue.arpu" value={p.revenue.arpu} suffix="€" />
            <Field label="Taux d'attrition (churn)" path="revenue.churnRate" value={p.revenue.churnRate} type="pct" />
          </>
        ) : (
          <>
            <Field label="Unités année 1" path="revenue.unitsYear1" value={p.revenue.unitsYear1} />
            <Field label="Prix unitaire" path="revenue.pricePerUnit" value={p.revenue.pricePerUnit} suffix="€" />
          </>
        )}
        <Field label="Croissance annuelle" path="revenue.growthRate" value={p.revenue.growthRate} type="pct" />
        <Field label="Montée en charge an 1" path="revenue.rampUpYear1" value={p.revenue.rampUpYear1} type="pct" />
      </Group>

      <Group title="🧾 Charges">
        <Field label="Coût des ventes (COGS)" path="costs.cogsPct" value={p.costs.cogsPct} type="pct" />
        <Field label="Loyer / mois" path="costs.rentMonthly" value={p.costs.rentMonthly} suffix="€" />
        <Field label="Masse salariale / mois" path="costs.payrollMonthly" value={p.costs.payrollMonthly} suffix="€" />
        <Field label="Rému. dirigeant / mois" path="costs.ownerSalaryMonthly" value={p.costs.ownerSalaryMonthly} suffix="€" />
        <Field label="Marketing (% CA)" path="costs.marketingPctRevenue" value={p.costs.marketingPctRevenue} type="pct" />
        <Field label="Autres charges fixes / mois" path="costs.otherFixedMonthly" value={p.costs.otherFixedMonthly} suffix="€" />
        <Field label="Inflation des charges" path="costs.inflationRate" value={p.costs.inflationRate} type="pct" step={0.1} />
      </Group>

      <Group title="⚙️ Opérationnel">
        <Field
          label="Mode de gestion"
          path="operations.managementMode"
          value={p.operations.managementMode}
          type="select"
          options={[
            { value: "active", label: "Active" },
            { value: "hybride", label: "Hybride" },
            { value: "passive", label: "Passive" },
          ]}
        />
        <Field label="Heures dirigeant / sem." path="operations.ownerHoursPerWeek" value={p.operations.ownerHoursPerWeek} suffix="h" />
        <Field label="Nombre d'employés" path="operations.staffCount" value={p.operations.staffCount} />
        <Field label="Automatisation (0-100)" path="operations.automationLevel" value={p.operations.automationLevel} />
        <Field label="Maturité process (0-100)" path="operations.processMaturity" value={p.operations.processMaturity} />
        <Field label="Dépendance homme-clé (0-100)" path="operations.keyManDependency" value={p.operations.keyManDependency} />
      </Group>

      <Group title="🌍 Marché & tendances">
        <Field label="Taille marché (M€)" path="market.marketSizeM" value={p.market.marketSizeM} />
        <Field label="Croissance marché" path="market.marketGrowthRate" value={p.market.marketGrowthRate} type="pct" />
        <Field label="Concurrence (0-100)" path="market.competitionLevel" value={p.market.competitionLevel} />
        <Field label="Réglementation (0-100)" path="market.regulatoryIntensity" value={p.market.regulatoryIntensity} />
        <Field label="Barrières à l'entrée (0-100)" path="market.barriersToEntry" value={p.market.barriersToEntry} />
        <Field label="Scalabilité (0-100)" path="market.scalabilityPotential" value={p.market.scalabilityPotential} />
        <Field label="Tendance sociétale (0-100)" path="market.trendSocietal" value={p.market.trendSocietal} />
        <Field label="Tendance sociale (0-100)" path="market.trendSocial" value={p.market.trendSocial} />
        <Field label="Tendance économique (0-100)" path="market.trendEconomic" value={p.market.trendEconomic} />
      </Group>

      <Group title="🎯 Hypothèses globales">
        <Field label="Horizon" path="global.horizonYears" value={p.global.horizonYears} suffix="ans" />
        <Field label="Taux d'actualisation" path="global.discountRate" value={p.global.discountRate} type="pct" step={0.1} />
        <Field label="Croissance perpétuelle (valeur terminale)" path="global.perpetualGrowthRate" value={p.global.perpetualGrowthRate} type="pct" step={0.1} />
        <Field label="Taux d'IS" path="global.taxRate" value={p.global.taxRate} type="pct" />
      </Group>
    </aside>
  );
}
