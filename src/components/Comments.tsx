import React, { useState } from "react";
import { useApp } from "../state";
import type { AnalysisModule } from "../engine/types";

// Bloc de commentaires attaché à un module/livrable.
// Les commentaires sont transmis au LLM comme contexte pour ajuster l'analyse.
export function Comments({ module }: { module: AnalysisModule }) {
  const { comments, addComment, toggleComment, removeComment } = useApp();
  const [text, setText] = useState("");
  const [target, setTarget] = useState("");

  const mine = comments.filter((c) => c.module === module);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    addComment(module, target.trim() || "Général", text.trim());
    setText("");
    setTarget("");
  }

  return (
    <div className="comments">
      <h4>💬 Commentaires & retours <span className="muted">(repris par le LLM)</span></h4>
      <form onSubmit={submit} className="comment-form">
        <input
          placeholder="Cible (ex: hypothèse CA, ligne EBITDA...)"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <textarea
          placeholder="Votre retour : ce que vous voudriez ajuster, contester ou approfondir…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
        />
        <button type="submit">Ajouter le commentaire</button>
      </form>
      {mine.length === 0 ? (
        <p className="muted">Aucun commentaire sur ce module.</p>
      ) : (
        <ul className="comment-list">
          {mine.map((c) => (
            <li key={c.id} className={c.resolved ? "resolved" : ""}>
              <div>
                <strong>{c.target}</strong> — {c.text}
              </div>
              <div className="comment-actions">
                <button onClick={() => toggleComment(c.id)}>
                  {c.resolved ? "Rouvrir" : "Résolu"}
                </button>
                <button onClick={() => removeComment(c.id)}>Suppr.</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
