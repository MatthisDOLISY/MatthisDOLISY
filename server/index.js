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
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

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
  res.json({ ok: true, llm: !!client, model: MODEL });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, context } = req.body || {};
    if (!client) {
      return res.json({
        reply:
          "⚠️ Le LLM n'est pas configuré. Ajoutez votre clé `ANTHROPIC_API_KEY` dans un fichier `.env` à la racine, puis relancez `npm run dev`. En attendant, vous pouvez utiliser tous les modules d'analyse et les exports.",
        params: null,
        offline: true,
      });
    }

    const contextBlock = context
      ? `Contexte courant du projet :\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``
      : "";

    const apiMessages = [
      ...(contextBlock
        ? [{ role: "user", content: contextBlock }]
        : []),
      ...(messages || []).map((m) => ({ role: m.role, content: m.content })),
    ];

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });

    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

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
  console.log(`API Business Evaluator sur http://localhost:${PORT} (LLM: ${client ? MODEL : "non configuré"})`);
});
