import type { BusinessParameters } from "./types";
import { detectProfile } from "./kpis";

// Seuil de notation : bon / acceptable, avec une référence affichable.
export interface Threshold {
  good: number;
  ok: number;
  ref: string;
}

// Jeu de benchmarks pour un sous-secteur. Seules les métriques pertinentes
// du profil sont renseignées.
export interface BenchmarkSet {
  key: string;
  label: string;
  grossMargin: Threshold;
  ebitdaMargin: Threshold;
  churn?: Threshold;
  ltvCac?: Threshold;
  cacPaybackMonths?: Threshold;
  ruleOf40?: Threshold;
  contributionMargin?: Threshold;
  grossYield?: Threshold;
  netYield?: Threshold;
  cashOnCash?: Threshold;
  ltv?: Threshold;
  dscr?: Threshold;
}

// Bibliothèque de benchmarks par sous-secteur.
const SETS: Record<string, BenchmarkSet> = {
  // --- Récurrent ---
  saas: {
    key: "saas",
    label: "SaaS / logiciel",
    grossMargin: { good: 0.8, ok: 0.7, ref: "> 80 %" },
    ebitdaMargin: { good: 0.2, ok: 0.05, ref: "> 20 %" },
    churn: { good: 0.05, ok: 0.15, ref: "< 5 %/an" },
    ltvCac: { good: 3, ok: 1, ref: "> 3×" },
    cacPaybackMonths: { good: 12, ok: 18, ref: "< 12 mois" },
    ruleOf40: { good: 40, ok: 25, ref: "≥ 40" },
  },
  abonnement_conso: {
    key: "abonnement_conso",
    label: "Abonnement B2C / lieu",
    grossMargin: { good: 0.6, ok: 0.45, ref: "> 60 %" },
    ebitdaMargin: { good: 0.15, ok: 0.05, ref: "> 15 %" },
    churn: { good: 0.1, ok: 0.25, ref: "< 10 %/an" },
    ltvCac: { good: 3, ok: 1.5, ref: "> 3×" },
    cacPaybackMonths: { good: 12, ok: 24, ref: "< 12 mois" },
    ruleOf40: { good: 30, ok: 15, ref: "≥ 30" },
  },
  fitness: {
    key: "fitness",
    label: "Salle de sport / fitness",
    grossMargin: { good: 0.7, ok: 0.55, ref: "> 70 %" },
    ebitdaMargin: { good: 0.2, ok: 0.1, ref: "> 20 %" },
    churn: { good: 0.3, ok: 0.45, ref: "< 30 %/an" },
    ltvCac: { good: 3, ok: 1.5, ref: "> 3×" },
    cacPaybackMonths: { good: 6, ok: 12, ref: "< 6 mois" },
    ruleOf40: { good: 30, ok: 15, ref: "≥ 30" },
  },
  // --- Transactionnel ---
  restaurant: {
    key: "restaurant",
    label: "Restauration",
    grossMargin: { good: 0.7, ok: 0.62, ref: "> 70 % (food cost < 30 %)" },
    ebitdaMargin: { good: 0.12, ok: 0.06, ref: "> 12 %" },
    contributionMargin: { good: 0.25, ok: 0.15, ref: "> 25 %" },
  },
  ecommerce: {
    key: "ecommerce",
    label: "E-commerce / DNVB",
    grossMargin: { good: 0.45, ok: 0.35, ref: "> 45 %" },
    ebitdaMargin: { good: 0.1, ok: 0.03, ref: "> 10 %" },
    contributionMargin: { good: 0.25, ok: 0.12, ref: "> 25 %" },
  },
  retail: {
    key: "retail",
    label: "Commerce / retail",
    grossMargin: { good: 0.4, ok: 0.3, ref: "> 40 %" },
    ebitdaMargin: { good: 0.08, ok: 0.03, ref: "> 8 %" },
    contributionMargin: { good: 0.2, ok: 0.1, ref: "> 20 %" },
  },
  services_conseil: {
    key: "services_conseil",
    label: "Conseil / ESN (régie)",
    grossMargin: { good: 0.35, ok: 0.25, ref: "> 35 % (marge de production ESN)" },
    ebitdaMargin: { good: 0.12, ok: 0.06, ref: "> 12 %" },
    contributionMargin: { good: 0.3, ok: 0.2, ref: "> 30 %" },
  },
  // --- Patrimonial ---
  immobilier_residentiel: {
    key: "immobilier_residentiel",
    label: "Immobilier résidentiel",
    grossMargin: { good: 0.7, ok: 0.55, ref: "> 70 %" },
    ebitdaMargin: { good: 0.6, ok: 0.45, ref: "> 60 % (NOI)" },
    grossYield: { good: 0.07, ok: 0.05, ref: "> 7 %" },
    netYield: { good: 0.045, ok: 0.03, ref: "> 4,5 %" },
    cashOnCash: { good: 0.06, ok: 0.03, ref: "> 6 %" },
    ltv: { good: 0.75, ok: 0.9, ref: "< 75 %" },
    dscr: { good: 1.2, ok: 1.05, ref: "> 1,2" },
  },
  immobilier_commercial: {
    key: "immobilier_commercial",
    label: "Immobilier commercial / tertiaire",
    grossMargin: { good: 0.75, ok: 0.6, ref: "> 75 %" },
    ebitdaMargin: { good: 0.7, ok: 0.55, ref: "> 70 % (NOI)" },
    grossYield: { good: 0.08, ok: 0.06, ref: "> 8 %" },
    netYield: { good: 0.06, ok: 0.045, ref: "> 6 %" },
    cashOnCash: { good: 0.08, ok: 0.05, ref: "> 8 %" },
    ltv: { good: 0.65, ok: 0.8, ref: "< 65 %" },
    dscr: { good: 1.3, ok: 1.15, ref: "> 1,3" },
  },
  // --- Fallbacks génériques par profil ---
  generic_recurrent: {
    key: "generic_recurrent",
    label: "Récurrent (générique)",
    grossMargin: { good: 0.7, ok: 0.5, ref: "> 70 %" },
    ebitdaMargin: { good: 0.2, ok: 0.05, ref: "> 20 %" },
    churn: { good: 0.08, ok: 0.2, ref: "< 8 %/an" },
    ltvCac: { good: 3, ok: 1, ref: "> 3×" },
    cacPaybackMonths: { good: 12, ok: 18, ref: "< 12 mois" },
    ruleOf40: { good: 40, ok: 25, ref: "≥ 40" },
  },
  generic_transactionnel: {
    key: "generic_transactionnel",
    label: "Transactionnel (générique)",
    grossMargin: { good: 0.5, ok: 0.35, ref: "> 50 %" },
    ebitdaMargin: { good: 0.12, ok: 0.05, ref: "> 12 %" },
    contributionMargin: { good: 0.35, ok: 0.2, ref: "> 35 %" },
  },
  generic_patrimonial: {
    key: "generic_patrimonial",
    label: "Patrimonial (générique)",
    grossMargin: { good: 0.7, ok: 0.55, ref: "> 70 %" },
    ebitdaMargin: { good: 0.55, ok: 0.4, ref: "> 55 % (NOI)" },
    grossYield: { good: 0.08, ok: 0.06, ref: "> 7-8 %" },
    netYield: { good: 0.05, ok: 0.035, ref: "> 4-5 %" },
    cashOnCash: { good: 0.08, ok: 0.04, ref: "> 6-8 %" },
    ltv: { good: 0.7, ok: 0.85, ref: "< 80 %" },
    dscr: { good: 1.25, ok: 1.1, ref: "> 1,25" },
  },
};

// Options proposées dans l'interface (le premier = détection automatique).
export const benchmarkSectorOptions: { value: string; label: string }[] = [
  { value: "auto", label: "Auto (selon le secteur)" },
  { value: "saas", label: "SaaS / logiciel" },
  { value: "abonnement_conso", label: "Abonnement B2C / lieu" },
  { value: "fitness", label: "Salle de sport / fitness" },
  { value: "restaurant", label: "Restauration" },
  { value: "ecommerce", label: "E-commerce / DNVB" },
  { value: "retail", label: "Commerce / retail" },
  { value: "services_conseil", label: "Conseil / ESN (régie)" },
  { value: "immobilier_residentiel", label: "Immobilier résidentiel" },
  { value: "immobilier_commercial", label: "Immobilier commercial" },
];

// Détection automatique du sous-secteur en respectant le profil détecté.
function autoDetect(p: BusinessParameters): string {
  const profile = detectProfile(p);
  const t = `${p.identity.sector} ${p.identity.businessModel}`.toLowerCase();
  if (profile === "recurrent") {
    if (/saas|logiciel|software|cloud|plateforme/.test(t)) return "saas";
    if (/sport|fitness|salle|gym/.test(t)) return "fitness";
    return "abonnement_conso";
  }
  if (profile === "transactionnel") {
    if (/restau|food|brasserie|bistro|traiteur/.test(t)) return "restaurant";
    if (/e-?commerce|dnvb|en ligne|shop|boutique/.test(t)) return "ecommerce";
    if (/conseil|consulting|esn|ssii|r[ée]gie|services? num|informatique|freelanc/.test(t))
      return "services_conseil";
    return "retail";
  }
  // patrimonial
  if (/commercial|bureau|tertiaire|entrep|local/.test(t)) return "immobilier_commercial";
  return "immobilier_residentiel";
}

export function getBenchmarks(p: BusinessParameters): BenchmarkSet {
  const explicit = p.identity.benchmarkSector;
  const key = !explicit || explicit === "auto" ? autoDetect(p) : explicit;
  return SETS[key] ?? SETS.generic_recurrent;
}
