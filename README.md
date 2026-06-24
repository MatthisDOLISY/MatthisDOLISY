# 📈 Business Evaluator

Application d'évaluation de business : elle articule **plusieurs niveaux d'analyse** (financière, opérationnelle, marché) en une **synthèse globale**, permet de **modifier toutes les hypothèses** du projet avec recalcul instantané, intègre un **assistant LLM** pour piloter les changements, et produit des **livrables éditables** (Business Plan **Excel** et Document d'investissement **Word**).

> ℹ️ Ce dépôt est le dépôt de profil GitHub de @MatthisDOLISY. Le README de profil d'origine est conservé sur la branche `main` ; ce contenu n'existe que sur la branche de l'application.

## ✨ Fonctionnalités

### Modules d'analyse (chacun avec son livrable et ses commentaires)
- **💰 Financier** — investissement, financement, compte de résultat, cash-flow, **VAN, TRI, ROI, délai de retour, DSCR, seuil de rentabilité**.
- **⚙️ Opérationnel** — **gestion active / passive** : dépendance au dirigeant, automatisation, maturité des process, indépendance à l'homme-clé.
- **🌍 Marché** — **contraintes réglementaires**, **barrières à l'entrée**, **scalabilité**, et **projection au regard des hyper-tendances** sociétales, sociales et économiques.
- **🧭 Synthèse globale** — score pondéré, verdict, **matrice SWOT** et **radar** qui articulent tous les modules.
- **🎚️ Sensibilité & scénarios** — scénarios **pessimiste / base / optimiste** + **analyse de sensibilité** d'un levier clé (±30 %) sur la VAN, le TRI et le score.
- **🔀 Comparaison de variantes** — enregistrez plusieurs versions (ex: Lyon vs Bordeaux) et comparez-les côte à côte.

> Les indicateurs financiers incluent une **valeur terminale** (modèle de Gordon-Shapiro), affichée séparément pour la transparence. Des **graphiques** (courbes, barres, radar) illustrent chaque analyse.

### Modèles de secteur préconfigurés
Chargez en un clic un projet type : **SaaS B2B, e-commerce/DNVB, restauration, immobilier locatif, franchise** (ou le café-coworking par défaut).

### Pilotage
- **Panneau de paramètres** : modifiez n'importe quelle hypothèse (investissement, localisation, prix, charges, tendances…) → tout se recalcule en direct.
- **Assistant LLM intégré** : discutez de vos changements (« et si je m'installe à Bordeaux ? », « passe le CAPEX à 250k »). Le LLM propose des **changements de paramètres applicables en un clic**.

### Livrables modifiables dans l'application
- **📊 Business Plan Excel (`.xlsx`)** — grille recalculée en direct, **cellules éditables** (double-clic pour forcer une valeur), export multi-feuilles (Hypothèses, Business Plan, Synthèse, Scores).
- **📄 Document d'investissement Word (`.docx`)** — **synthétise l'ensemble** des modules ; section de synthèse éditable, rédaction/révision assistée par le LLM.
- **💬 Commentaires** sur chaque module/livrable, **pris en compte par le LLM** pour ajuster les analyses.

## 🚀 Démarrage

```bash
npm install

# (Optionnel) activer l'assistant LLM
cp .env.example .env   # puis renseignez ANTHROPIC_API_KEY

npm run dev            # client (5173) + API (8787)
```

Ouvrez http://localhost:5173

> Sans clé API, toutes les analyses et tous les exports fonctionnent ; seul le chat LLM est désactivé.

### Build de production
```bash
npm run build      # génère dist/
npm start          # sert dist/ + API sur le port 8787
```

## 🏗️ Architecture

```
src/
  engine/      Modèle de domaine + moteurs de calcul (finance, scoring)
  components/  UI React (modules, panneau de paramètres, chat, livrables)
  lib/         Formatage + génération Excel/Word + construction du business plan
  llm/         Client de l'assistant
  state.tsx    État global (paramètres, commentaires, overrides) + recalcul
server/        API Express : proxy LLM (Claude) + service du build
```

Le **moteur** (`src/engine`) est l'unique source de vérité : les paramètres alimentent
les calculs financiers, qui alimentent les scores de chaque module, qui alimentent
la synthèse globale et les livrables.

## 🔧 Stack
React + TypeScript (Vite) · Express · ExcelJS · docx · SDK Anthropic
