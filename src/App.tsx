import React, { useState } from "react";
import { AppProvider, useApp } from "./state";
import { ParametersPanel } from "./components/ParametersPanel";
import { ChatPanel } from "./components/ChatPanel";
import { GlobalDashboard } from "./components/GlobalDashboard";
import { FinancialModule } from "./components/FinancialModule";
import { OperationalModule } from "./components/OperationalModule";
import { MarketModule } from "./components/MarketModule";
import { BusinessPlanModule } from "./components/BusinessPlanModule";
import { InvestmentDocModule } from "./components/InvestmentDocModule";
import { SensitivityModule } from "./components/SensitivityModule";
import { VariantsModule } from "./components/VariantsModule";
import { Badge } from "./components/common";

type Tab =
  | "global"
  | "financier"
  | "operationnel"
  | "marche"
  | "sensibilite"
  | "variantes"
  | "business-plan"
  | "investissement";

const TABS: { id: Tab; label: string }[] = [
  { id: "global", label: "🧭 Synthèse globale" },
  { id: "financier", label: "💰 Financier" },
  { id: "operationnel", label: "⚙️ Opérationnel" },
  { id: "marche", label: "🌍 Marché" },
  { id: "sensibilite", label: "🎚️ Sensibilité" },
  { id: "variantes", label: "🔀 Variantes" },
  { id: "business-plan", label: "📊 Business Plan (Excel)" },
  { id: "investissement", label: "📄 Document (Word)" },
];

function Shell() {
  const [tab, setTab] = useState<Tab>("global");
  const [chatOpen, setChatOpen] = useState(true);
  const { global, params } = useApp();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">📈</span>
          <div>
            <div className="brand-title">Business Evaluator</div>
            <div className="brand-sub">{params.identity.projectName}</div>
          </div>
        </div>
        <div className="topbar-right">
          <Badge rating={global.rating} />
          <span className="topscore">{global.score.toFixed(0)}/100</span>
          <button className="ghost" onClick={() => setChatOpen((v) => !v)}>
            {chatOpen ? "Masquer l'assistant" : "Assistant LLM"}
          </button>
        </div>
      </header>

      <div className="layout">
        <ParametersPanel />

        <main className="main">
          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "tab active" : "tab"}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="content">
            {tab === "global" && <GlobalDashboard />}
            {tab === "financier" && <FinancialModule />}
            {tab === "operationnel" && <OperationalModule />}
            {tab === "marche" && <MarketModule />}
            {tab === "sensibilite" && <SensitivityModule />}
            {tab === "variantes" && <VariantsModule />}
            {tab === "business-plan" && <BusinessPlanModule />}
            {tab === "investissement" && <InvestmentDocModule />}
          </div>
        </main>

        {chatOpen && (
          <aside className="chat-col">
            <ChatPanel />
          </aside>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
