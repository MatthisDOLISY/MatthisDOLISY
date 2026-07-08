import React from "react";
import { useApp } from "../state";
import { sendChat, checkHealth, type ChatMessage } from "../llm/client";

interface UiMessage extends ChatMessage {
  params?: Record<string, unknown> | null;
}

export function ChatPanel() {
  const { params, finance, global, comments, updateParams } = useApp();
  const [messages, setMessages] = React.useState<UiMessage[]>([
    {
      role: "assistant",
      content:
        "Bonjour 👋 Je suis votre analyste intégré. Décrivez un changement (« et si on s'installait à Bordeaux ? », « passe le CAPEX à 250k », « réduis la dépendance au dirigeant »…) et je recalcule l'impact. Je peux appliquer les changements de paramètres directement.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [llmOn, setLlmOn] = React.useState<boolean | null>(null);
  const [providerName, setProviderName] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    checkHealth().then((h) => {
      setLlmOn(h.llm);
      setProviderName(h.provider);
    });
  }, []);

  React.useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const next: UiMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const history: ChatMessage[] = next.map((m) => ({ role: m.role, content: m.content }));
      const openComments = comments.filter((c) => !c.resolved);
      const res = await sendChat(history, {
        params,
        analysis: {
          npv: finance.npv,
          irr: finance.irr,
          paybackYears: finance.paybackYears,
          score: global.score,
          rating: global.rating,
          modules: {
            financier: global.modules.financier.score,
            operationnel: global.modules.operationnel.score,
            marche: global.modules.marche.score,
          },
        },
        comments: openComments.map((c) => ({ module: c.module, target: c.target, text: c.text })),
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply, params: res.params }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "⚠️ Erreur : " + (e as Error).message },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function apply(p: Record<string, unknown>) {
    updateParams(p);
    setMessages((m) => [
      ...m,
      { role: "assistant", content: "✅ Paramètres appliqués. Les analyses ont été recalculées." },
    ]);
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <h3>🤖 Assistant LLM{providerName ? ` · ${providerName}` : ""}</h3>
        <span className={`llm-dot ${llmOn ? "on" : "off"}`} title={llmOn ? `Connecté (${providerName})` : "LLM non configuré"} />
      </div>
      {llmOn === false && (
        <div className="chat-warn">
          LLM non configuré. Ajoutez une clé gratuite <code>GROQ_API_KEY</code> dans <code>.env</code> et relancez.
          Les analyses et exports fonctionnent sans le LLM.
        </div>
      )}
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="msg-body">{renderText(m.content)}</div>
            {m.params && Object.keys(m.params).length > 0 && (
              <div className="param-suggest">
                <div className="param-suggest-title">Changements proposés :</div>
                <ul>
                  {Object.entries(m.params).map(([k, v]) => (
                    <li key={k}>
                      <code>{k}</code> → <strong>{String(v)}</strong>
                    </li>
                  ))}
                </ul>
                <button className="primary small" onClick={() => apply(m.params!)}>
                  Appliquer ces changements
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="msg assistant"><div className="msg-body typing">…</div></div>}
      </div>
      <div className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Posez une question ou demandez un changement…"
          rows={2}
        />
        <button className="primary" onClick={send} disabled={busy}>
          Envoyer
        </button>
      </div>
    </div>
  );
}

// Rend le texte en masquant les blocs ```params``` (déjà affichés séparément).
function renderText(text: string): React.ReactNode {
  const cleaned = text.replace(/```params[\s\S]*?```/g, "").trim();
  return cleaned.split("\n").map((line, i) => <p key={i}>{line}</p>);
}
