import React from "react";
import { useApp } from "../state";
import { exportWord } from "../lib/exportWord";
import { sendChat } from "../llm/client";
import { Comments } from "./Comments";

export function InvestmentDocModule() {
  const { params, finance, global, narrative, setNarrative, comments } = useApp();
  const [busy, setBusy] = React.useState(false);
  const [drafting, setDrafting] = React.useState(false);

  async function download() {
    setBusy(true);
    try {
      await exportWord(params, finance, global, narrative);
    } catch (e) {
      alert("Erreur export Word : " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Demande au LLM de rédiger / réviser la synthèse en tenant compte des commentaires.
  async function draftWithLLM() {
    setDrafting(true);
    try {
      const openComments = comments.filter((c) => !c.resolved);
      const prompt =
        "Rédige (ou révise) la SYNTHÈSE du document d'investissement pour ce projet, en 4 à 6 paragraphes : " +
        "thèse d'investissement, points forts financiers, risques opérationnels et de marché, recommandation. " +
        "Tiens compte des commentaires de l'utilisateur ci-dessous. Réponds UNIQUEMENT avec le texte de la synthèse, sans bloc params.\n\n" +
        "Synthèse actuelle :\n" +
        narrative +
        "\n\nCommentaires utilisateur :\n" +
        (openComments.length
          ? openComments.map((c) => `- [${c.module}/${c.target}] ${c.text}`).join("\n")
          : "(aucun)");
      const res = await sendChat([{ role: "user", content: prompt }], {
        params,
        finance: summarizeFinance(finance),
        global: summarizeGlobal(global),
      });
      if (res.offline) {
        alert(res.reply);
      } else {
        setNarrative(res.reply.replace(/```params[\s\S]*?```/g, "").trim());
      }
    } catch (e) {
      alert("Erreur LLM : " + (e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="module">
      <div className="module-head">
        <h2>📄 Document d'investissement (Word)</h2>
        <div className="actions">
          <button className="ghost" onClick={draftWithLLM} disabled={drafting}>
            {drafting ? "Rédaction…" : "✨ Rédiger la synthèse avec le LLM"}
          </button>
          <button className="primary" onClick={download} disabled={busy}>
            {busy ? "Génération…" : "⬇️ Exporter en .docx"}
          </button>
        </div>
      </div>

      <p className="lead">
        Ce document <strong>synthétise l'ensemble</strong> des modules (financier, opérationnel, marché, SWOT,
        recommandation). La section de synthèse ci-dessous est <strong>éditable</strong> ; vos commentaires et
        cette synthèse sont pris en compte par le LLM.
      </p>

      <div className="doc-preview">
        <div className="doc-cover">
          <div className="doc-title">DOCUMENT D'INVESTISSEMENT</div>
          <div className="doc-project">{params.identity.projectName}</div>
          <div className="doc-sub">
            {params.identity.sector} — {params.identity.location}
          </div>
          <div className="doc-score">
            Score global : {global.score.toFixed(0)}/100 — {global.rating}
          </div>
        </div>

        <h3>Synthèse de l'analyse (éditable)</h3>
        <textarea
          className="narrative"
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          rows={12}
        />

        <h3>Sommaire du document généré</h3>
        <ol className="toc">
          <li>Résumé exécutif & verdict</li>
          <li>Synthèse de l'analyse (votre texte ci-dessus)</li>
          <li>Analyse financière (indicateurs + projection pluriannuelle)</li>
          <li>Contraintes opérationnelles (gestion active/passive)</li>
          <li>Analyse marché (réglementaire, scalabilité, hyper-tendances)</li>
          <li>Matrice SWOT</li>
          <li>Recommandation</li>
        </ol>
      </div>

      <Comments module="investissement" />
    </div>
  );
}

function summarizeFinance(f: any) {
  return {
    npv: f.npv,
    irr: f.irr,
    roi: f.roi,
    paybackYears: f.paybackYears,
    totalInvestment: f.totalInvestment,
    breakEvenRevenue: f.breakEvenRevenue,
  };
}
function summarizeGlobal(g: any) {
  return {
    score: g.score,
    rating: g.rating,
    modules: {
      financier: g.modules.financier.score,
      operationnel: g.modules.operationnel.score,
      marche: g.modules.marche.score,
    },
    swot: g.swot,
  };
}
