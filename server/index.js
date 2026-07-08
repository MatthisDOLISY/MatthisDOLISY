import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 8787;

// ---------------------------------------------------------------------------
// Détection du fournisseur LLM. Priorité aux options GRATUITES (Groq), puis
// tout endpoint compatible OpenAI (OpenAI, Google Gemini, Ollama local…),
// puis Anthropic. Le premier dont la clé est présente est utilisé.
// ---------------------------------------------------------------------------
function resolveProvider() {
  if (process.env.GROQ_API_KEY) {
    return {
      kind: "openai",
      name: "Groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      kind: "openai",
      name: "OpenAI-compatible",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    };
  }
  // Ollama local (aucune clé requise) : définir OLLAMA_MODEL pour l'activer.
  if (process.env.OLLAMA_MODEL) {
    return {
      kind: "openai",
      name: "Ollama (local)",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
      apiKey: "ollama",
      model: process.env.OLLAMA_MODEL,
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      kind: "anthropic",
      name: "Anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
    };
  }
  return null;
}

const provider = resolveProvider();
const anthropic =
  provider?.kind === "anthropic" ? new Anthropic({ apiKey: provider.apiKey }) : null;

const SYSTEM_PROMPT = `Tu es un analyste financier et stratégique senior intégré à une application d'évaluation de business.
Tu aides l'utilisateur à évaluer et améliorer son projet à travers quatre modules : financier (investissement, rentabilité, cash-flow), opérationnel (gestion active/passive), marché (réglementation, scalabilité, barrières à l'entrée, hyper-tendances) et la synthèse globale.

Tu reçois en contexte les PARAMÈTRES du projet (JSON), les RÉSULTATS d'analyse et les COMMENTAIRES de l'utilisateur sur les livrables.

Règles :
- Réponds en français, de façon concise, concrète et chiffrée.
- Quand l'utilisateur veut MODIFIER une hypothèse (investissement, localisation, prix, charges, etc.), propose les changements puis termine ta réponse par un bloc de paramètres modifiés au format EXACT :
\`\`\`params
{ "chemin.vers.le.parametre": valeur, ... }
\`\`\`
Utilise la notation pointée des clés du JSON de paramètres (ex: "investment.capex", "market.regulatoryIntensity", "identity.location"). N'inclus QUE les clés qui changent.
- Prends en compte les commentaires de l'utilisateur sur les livrables pour ajuster ton analyse.
- Explique toujours brièvement l'impact attendu d'un changement avant de fournir le bloc params.`;

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    llm: !!provider,
    provider: provider?.name || null,
    model: provider?.model || null,
  });
});

// Appelle un endpoint compatible OpenAI (Groq, OpenAI, Gemini, Ollama…).
async function callOpenAICompatible(apiMessages) {
  const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 1500,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...apiMessages],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message || `HTTP ${resp.status}`);
  }
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(apiMessages) {
  const resp = await anthropic.messages.create({
    model: provider.model,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: apiMessages,
  });
  return resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, context } = req.body || {};
    if (!provider) {
      return res.json({
        reply:
          "⚠️ Aucun LLM n'est configuré. Ajoutez une clé gratuite Groq (`GROQ_API_KEY`) dans le fichier `.env`, puis relancez `npm run dev`. En attendant, tous les modules d'analyse et les exports fonctionnent.",
        params: null,
        offline: true,
      });
    }

    const contextBlock = context
      ? `Contexte courant du projet :\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``
      : "";

    const apiMessages = [
      ...(contextBlock ? [{ role: "user", content: contextBlock }] : []),
      ...(messages || []).map((m) => ({ role: m.role, content: m.content })),
    ];

    const text =
      provider.kind === "anthropic"
        ? await callAnthropic(apiMessages)
        : await callOpenAICompatible(apiMessages);

    res.json({ reply: text, params: extractParams(text), offline: false });
  } catch (err) {
    console.error("Erreur /api/chat:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Extrait un éventuel bloc ```params {...}``` de la réponse du LLM.
function extractParams(text) {
  const m = text.match(/```params\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return null;
  }
}

// En production, sert le build statique.
const distDir = path.join(__dirname, "..", "dist");
app.use(express.static(distDir));
app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) res.status(404).send("Lancez `npm run dev` (mode dev) ou `npm run build`.");
  });
});

app.listen(PORT, () => {
  console.log(
    `API Business Evaluator sur http://localhost:${PORT} (LLM: ${
      provider ? `${provider.name} — ${provider.model}` : "non configuré"
    })`
  );
});
