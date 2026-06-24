// ---------------------------------------------------------------------------
// Modèle de domaine : tous les paramètres modifiables d'un projet de business.
// C'est l'unique source de vérité ; tous les modules d'analyse en dérivent.
// ---------------------------------------------------------------------------

export type ManagementMode = "active" | "passive" | "hybride";
export type RevenueModel = "unitaire" | "recurrent";

export interface IdentityParams {
  projectName: string;
  sector: string;
  location: string;
  businessModel: string;
  description: string;
}

export interface InvestmentParams {
  /** CAPEX initial total (immobilisations, agencement, matériel...) en € */
  capex: number;
  /** Besoin en fonds de roulement initial en € */
  workingCapital: number;
  /** Durée d'amortissement des immobilisations en années */
  depreciationYears: number;
  /** Apport en capitaux propres en € */
  equity: number;
  /** Montant de la dette / emprunt en € */
  debt: number;
  /** Taux d'intérêt annuel de l'emprunt (ex: 0.05 = 5%) */
  interestRate: number;
  /** Durée de l'emprunt en années */
  loanTermYears: number;
}

export interface RevenueParams {
  model: RevenueModel;
  // Modèle unitaire
  unitsYear1: number;
  pricePerUnit: number;
  // Modèle récurrent
  customersYear1: number;
  arpu: number; // revenu moyen par client / an
  churnRate: number; // taux d'attrition annuel (0-1)
  // Commun
  growthRate: number; // croissance annuelle du volume (0-1)
  rampUpYear1: number; // fraction d'activité atteinte en année 1 (0-1)
}

export interface CostParams {
  cogsPct: number; // coût des ventes en % du CA (0-1)
  rentMonthly: number; // loyer mensuel €
  payrollMonthly: number; // masse salariale mensuelle € (hors dirigeant)
  ownerSalaryMonthly: number; // rémunération du dirigeant € / mois
  marketingPctRevenue: number; // budget marketing en % du CA (0-1)
  otherFixedMonthly: number; // autres charges fixes mensuelles €
  inflationRate: number; // inflation annuelle des charges (0-1)
}

export interface OperationsParams {
  managementMode: ManagementMode;
  ownerHoursPerWeek: number; // heures hebdo du dirigeant
  staffCount: number; // nombre d'employés
  automationLevel: number; // 0-100, degré d'automatisation/systématisation
  processMaturity: number; // 0-100, maturité des process / SOP
  keyManDependency: number; // 0-100, dépendance à une personne clé
}

export interface MarketParams {
  marketSizeM: number; // taille du marché adressable en M€
  marketGrowthRate: number; // croissance annuelle du marché (0-1)
  competitionLevel: number; // 0-100, intensité concurrentielle
  regulatoryIntensity: number; // 0-100, poids des contraintes réglementaires
  barriersToEntry: number; // 0-100, hauteur des barrières à l'entrée (protège le projet)
  scalabilityPotential: number; // 0-100, capacité à passer à l'échelle
  // Alignement aux hyper-tendances (0-100, 100 = parfaitement aligné/porteur)
  trendSocietal: number; // tendances sociétales (durabilité, valeurs...)
  trendSocial: number; // tendances sociales (modes de vie, démographie...)
  trendEconomic: number; // tendances économiques (pouvoir d'achat, taux...)
}

export interface GlobalParams {
  horizonYears: number; // horizon d'analyse (ex: 5)
  discountRate: number; // taux d'actualisation pour la VAN (0-1)
  taxRate: number; // taux d'IS (0-1)
}

export interface BusinessParameters {
  identity: IdentityParams;
  investment: InvestmentParams;
  revenue: RevenueParams;
  costs: CostParams;
  operations: OperationsParams;
  market: MarketParams;
  global: GlobalParams;
}

// ---------------------------------------------------------------------------
// Commentaires / retours utilisateur attachés aux livrables, repris par le LLM.
// ---------------------------------------------------------------------------
export interface Comment {
  id: string;
  module: AnalysisModule;
  target: string; // ligne / section concernée
  text: string;
  createdAt: number;
  resolved: boolean;
}

export type AnalysisModule =
  | "financier"
  | "operationnel"
  | "marche"
  | "global"
  | "business-plan"
  | "investissement";
