import type { BusinessParameters } from "./types";
import { defaultParameters, cloneParams } from "./defaults";

// Modèles de départ par secteur. Chaque preset part des valeurs par défaut
// puis surcharge les hypothèses caractéristiques du secteur.
export interface SectorPreset {
  id: string;
  label: string;
  build: () => BusinessParameters;
}

function preset(overrides: (p: BusinessParameters) => void): BusinessParameters {
  const p = cloneParams(defaultParameters);
  overrides(p);
  return p;
}

export const sectorPresets: SectorPreset[] = [
  {
    id: "default",
    label: "— Projet par défaut (Café-Coworking)",
    build: () => cloneParams(defaultParameters),
  },
  {
    id: "saas",
    label: "SaaS B2B",
    build: () =>
      preset((p) => {
        p.identity = {
          projectName: "SaaS « FlowOps »",
          sector: "Logiciel (SaaS B2B)",
          location: "Paris, France",
          businessModel: "Abonnement mensuel SaaS pour PME",
          description:
            "Plateforme SaaS d'automatisation des opérations pour PME, vendue en abonnement récurrent.",
          benchmarkSector: "saas",
        };
        p.investment = { capex: 120000, workingCapital: 60000, depreciationYears: 3, equity: 100000, debt: 80000, interestRate: 0.06, loanTermYears: 5 };
        p.revenue = { model: "recurrent", unitsYear1: 0, pricePerUnit: 0, customersYear1: 150, arpu: 1800, churnRate: 0.12, growthRate: 0.6, rampUpYear1: 0.5 };
        p.costs = { cogsPct: 0.15, rentMonthly: 2500, payrollMonthly: 22000, ownerSalaryMonthly: 4000, marketingPctRevenue: 0.2, otherFixedMonthly: 4000, inflationRate: 0.03 };
        p.operations = { managementMode: "active", ownerHoursPerWeek: 50, staffCount: 5, automationLevel: 70, processMaturity: 55, keyManDependency: 65 };
        p.market = { marketSizeM: 800, marketGrowthRate: 0.18, competitionLevel: 70, regulatoryIntensity: 35, barriersToEntry: 55, scalabilityPotential: 90, trendSocietal: 70, trendSocial: 65, trendEconomic: 70 };
      }),
  },
  {
    id: "ecommerce",
    label: "E-commerce / DNVB",
    build: () =>
      preset((p) => {
        p.identity = {
          projectName: "E-shop « Maison Verte »",
          sector: "E-commerce (produits durables)",
          location: "Nantes, France",
          businessModel: "Vente en ligne directe (DNVB) de produits écoresponsables",
          description:
            "Marque digitale native vendant des produits maison écoresponsables, modèle unitaire volume × prix.",
          benchmarkSector: "ecommerce",
        };
        p.investment = { capex: 90000, workingCapital: 80000, depreciationYears: 5, equity: 70000, debt: 100000, interestRate: 0.05, loanTermYears: 6 };
        p.revenue = { model: "unitaire", unitsYear1: 12000, pricePerUnit: 45, customersYear1: 0, arpu: 0, churnRate: 0, growthRate: 0.35, rampUpYear1: 0.6 };
        p.costs = { cogsPct: 0.45, rentMonthly: 3000, payrollMonthly: 9000, ownerSalaryMonthly: 3500, marketingPctRevenue: 0.18, otherFixedMonthly: 3500, inflationRate: 0.03 };
        p.operations = { managementMode: "hybride", ownerHoursPerWeek: 45, staffCount: 4, automationLevel: 60, processMaturity: 50, keyManDependency: 55 };
        p.market = { marketSizeM: 300, marketGrowthRate: 0.12, competitionLevel: 80, regulatoryIntensity: 40, barriersToEntry: 25, scalabilityPotential: 75, trendSocietal: 85, trendSocial: 70, trendEconomic: 45 };
      }),
  },
  {
    id: "restauration",
    label: "Restauration",
    build: () =>
      preset((p) => {
        p.identity = {
          projectName: "Restaurant « Le Comptoir »",
          sector: "Restauration",
          location: "Bordeaux, France",
          businessModel: "Restaurant de cuisine de saison, service midi et soir",
          description:
            "Restaurant de 60 couverts, cuisine de saison, modèle unitaire (couverts × ticket moyen).",
          benchmarkSector: "restaurant",
        };
        p.investment = { capex: 250000, workingCapital: 25000, depreciationYears: 9, equity: 110000, debt: 165000, interestRate: 0.045, loanTermYears: 8 };
        p.revenue = { model: "unitaire", unitsYear1: 22000, pricePerUnit: 32, customersYear1: 0, arpu: 0, churnRate: 0, growthRate: 0.08, rampUpYear1: 0.7 };
        p.costs = { cogsPct: 0.32, rentMonthly: 5500, payrollMonthly: 18000, ownerSalaryMonthly: 3500, marketingPctRevenue: 0.03, otherFixedMonthly: 3500, inflationRate: 0.03 };
        p.operations = { managementMode: "active", ownerHoursPerWeek: 60, staffCount: 8, automationLevel: 25, processMaturity: 35, keyManDependency: 80 };
        p.market = { marketSizeM: 60, marketGrowthRate: 0.04, competitionLevel: 75, regulatoryIntensity: 65, barriersToEntry: 30, scalabilityPotential: 30, trendSocietal: 60, trendSocial: 65, trendEconomic: 45 };
        p.vat = { liable: true, rate: 0.1, lagMonths: 1 }; // restauration sur place : TVA 10%
      }),
  },
  {
    id: "immobilier",
    label: "Immobilier locatif",
    build: () =>
      preset((p) => {
        p.identity = {
          projectName: "Investissement locatif « Résidence Pasteur »",
          sector: "Immobilier locatif",
          location: "Lille, France",
          businessModel: "Acquisition et location d'un petit immeuble de rapport",
          description:
            "Achat d'un immeuble de 6 logements mis en location longue durée, gestion passive via mandat.",
          benchmarkSector: "immobilier_residentiel",
        };
        p.investment = { capex: 600000, workingCapital: 10000, depreciationYears: 25, equity: 150000, debt: 460000, interestRate: 0.04, loanTermYears: 20 };
        p.revenue = { model: "recurrent", unitsYear1: 0, pricePerUnit: 0, customersYear1: 6, arpu: 9600, churnRate: 0.1, growthRate: 0.02, rampUpYear1: 0.9 };
        p.costs = { cogsPct: 0.0, rentMonthly: 0, payrollMonthly: 0, ownerSalaryMonthly: 0, marketingPctRevenue: 0.01, otherFixedMonthly: 1500, inflationRate: 0.02 };
        p.operations = { managementMode: "passive", ownerHoursPerWeek: 4, staffCount: 0, automationLevel: 70, processMaturity: 60, keyManDependency: 20 };
        p.market = { marketSizeM: 1200, marketGrowthRate: 0.03, competitionLevel: 50, regulatoryIntensity: 70, barriersToEntry: 60, scalabilityPotential: 50, trendSocietal: 55, trendSocial: 60, trendEconomic: 55 };
        p.global = { horizonYears: 10, discountRate: 0.06, taxRate: 0.25, perpetualGrowthRate: 0.015 };
        p.vat = { liable: false, rate: 0.2, lagMonths: 1 }; // location nue d'habitation : exonérée de TVA
      }),
  },
  {
    id: "franchise",
    label: "Franchise",
    build: () =>
      preset((p) => {
        p.identity = {
          projectName: "Franchise « FitClub »",
          sector: "Franchise (salle de sport)",
          location: "Toulouse, France",
          businessModel: "Exploitation d'une franchise de salle de sport à l'abonnement",
          description:
            "Ouverture d'une salle de sport en franchise, abonnements mensuels, concept et process fournis par le franchiseur.",
          benchmarkSector: "fitness",
        };
        p.investment = { capex: 320000, workingCapital: 20000, depreciationYears: 8, equity: 120000, debt: 220000, interestRate: 0.05, loanTermYears: 7 };
        p.revenue = { model: "recurrent", unitsYear1: 0, pricePerUnit: 0, customersYear1: 1200, arpu: 540, churnRate: 0.25, growthRate: 0.12, rampUpYear1: 0.6 };
        p.costs = { cogsPct: 0.08, rentMonthly: 8000, payrollMonthly: 10000, ownerSalaryMonthly: 3500, marketingPctRevenue: 0.08, otherFixedMonthly: 6000, inflationRate: 0.03 };
        p.operations = { managementMode: "hybride", ownerHoursPerWeek: 35, staffCount: 6, automationLevel: 65, processMaturity: 75, keyManDependency: 40 };
        p.market = { marketSizeM: 250, marketGrowthRate: 0.07, competitionLevel: 70, regulatoryIntensity: 45, barriersToEntry: 50, scalabilityPotential: 65, trendSocietal: 75, trendSocial: 80, trendEconomic: 50 };
      }),
  },
  {
    id: "esn_sap",
    label: "ESN / Conseil SAP (Île-de-France)",
    build: () =>
      preset((p) => {
        p.identity = {
          projectName: "ESN « SAP Advisory »",
          sector: "Conseil / ESN (régie)",
          location: "Paris, Île-de-France",
          businessModel:
            "Mise à disposition de consultants SAP technico-fonctionnels chez des grands comptes (régie / forfait), facturation au TJM",
          description:
            "ESN spécialisée SAP en Île-de-France : placement de consultants technico-fonctionnels chez des grands comptes, portée par la vague de migration S/4HANA. Revenu = jours facturés × taux journalier moyen (TJM).",
          benchmarkSector: "services_conseil",
        };
        // Asset-light mais BFR important (consultants payés mensuellement, clients à 45-60 j).
        p.investment = { capex: 30000, workingCapital: 220000, depreciationYears: 3, equity: 130000, debt: 120000, interestRate: 0.05, loanTermYears: 5 };
        // Modèle unitaire : unités = jours facturés/an (≈ 10 consultants × 215 j), prix = TJM.
        p.revenue = { model: "unitaire", unitsYear1: 2150, pricePerUnit: 700, customersYear1: 0, arpu: 0, churnRate: 0, growthRate: 0.2, rampUpYear1: 0.65 };
        // COGS = coût chargé des consultants délivrant la mission (~64 % du facturé).
        p.costs = { cogsPct: 0.64, rentMonthly: 3500, payrollMonthly: 20000, ownerSalaryMonthly: 5000, marketingPctRevenue: 0.02, otherFixedMonthly: 4000, inflationRate: 0.03 };
        p.operations = { managementMode: "hybride", ownerHoursPerWeek: 50, staffCount: 12, automationLevel: 40, processMaturity: 45, keyManDependency: 65 };
        p.market = { marketSizeM: 2000, marketGrowthRate: 0.08, competitionLevel: 75, regulatoryIntensity: 35, barriersToEntry: 35, scalabilityPotential: 60, trendSocietal: 55, trendSocial: 60, trendEconomic: 65 };
        p.global = { horizonYears: 5, discountRate: 0.12, taxRate: 0.25, perpetualGrowthRate: 0.02 };
      }),
  },
];
