import type { BusinessParameters } from "./types";

// Projet d'exemple : un coffee-shop / coworking — sert de point de départ.
export const defaultParameters: BusinessParameters = {
  identity: {
    projectName: "Café-Coworking « L'Atelier »",
    sector: "Restauration / Coworking",
    location: "Lyon, France",
    businessModel:
      "Lieu hybride café de spécialité + espaces de coworking à l'abonnement",
    description:
      "Ouverture d'un lieu de 200 m² combinant café de spécialité et postes de coworking en abonnement mensuel, ciblant freelances et indépendants.",
  },
  investment: {
    capex: 180000,
    workingCapital: 30000,
    depreciationYears: 7,
    equity: 90000,
    debt: 120000,
    interestRate: 0.045,
    loanTermYears: 7,
  },
  revenue: {
    model: "recurrent",
    unitsYear1: 0,
    pricePerUnit: 0,
    customersYear1: 210,
    arpu: 2700,
    churnRate: 0.15,
    growthRate: 0.18,
    rampUpYear1: 0.7,
  },
  costs: {
    cogsPct: 0.28,
    rentMonthly: 6000,
    payrollMonthly: 8000,
    ownerSalaryMonthly: 3000,
    marketingPctRevenue: 0.05,
    otherFixedMonthly: 2200,
    inflationRate: 0.02,
  },
  operations: {
    managementMode: "active",
    ownerHoursPerWeek: 45,
    staffCount: 3,
    automationLevel: 45,
    processMaturity: 50,
    keyManDependency: 55,
  },
  market: {
    marketSizeM: 45,
    marketGrowthRate: 0.08,
    competitionLevel: 60,
    regulatoryIntensity: 55,
    barriersToEntry: 35,
    scalabilityPotential: 45,
    trendSocietal: 70,
    trendSocial: 75,
    trendEconomic: 50,
  },
  global: {
    horizonYears: 5,
    discountRate: 0.1,
    taxRate: 0.25,
    perpetualGrowthRate: 0.02,
  },
};

// Clone profond utilitaire (structuredClone est dispo en Node 22 / navigateurs récents).
export function cloneParams(p: BusinessParameters): BusinessParameters {
  return structuredClone(p);
}
