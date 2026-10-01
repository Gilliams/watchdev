# 🧠 DevWatch — Actu · Veille · Marchés · Quiz · Enquêtes SQL

Application web personnelle qui concentre cinq outils :

- **☕ L'actu en 5 min** — synthèse quotidienne France / International / Géopolitique, générée par Claude à partir des dépêches des dernières 30 h, avec les liens vers les sources.
- **🌍 Géopolitique** — veille dédiée (Courrier International, Le Grand Continent, IRIS, Diploweb, ECFR, War on the Rocks, Foreign Policy, Carnegie).
- **📈 Marchés** — Take-Two, CD Projekt, S&P 500, CAC 40, Bitcoin et Solana : cours et variations 24 h / 7 j / 1 an, sans aucune clé d'API.
- **📡 Veille technologique** — agrégation automatique de flux RSS (PHP, Symfony, VueJS, Laravel, Sécurité, IA, FrontEnd, 3D, Bases de données, DevOps, Design Patterns, Drupal…) à la demande (bouton « 🔄 Rafraîchir ») via GitHub Actions, **articles francophones en tête**.
- **🎯 Quiz de révision** — 60+ questions back-end (niveau intermédiaire → expert) avec explications, pilotées par une **répétition espacée façon courbe d'Ebbinghaus** : un thème réussi à ≥ 80 % s'espace (1 → 3 → 7 → 14 → 30 → 60 → 120 jours), un thème raté (< 60 %) revient dès le lendemain.
- **🕵️ Enquêtes SQL** — trois affaires criminelles à résoudre en vraies requêtes SQL (SQLite dans le navigateur via sql.js) : jointures, agrégations, jointures temporelles, CTE récursives. Indices progressifs si tu bloques, requêtes solutions commentées.

Le tout est **hébergé gratuitement sur GitHub** (Pages + Actions), avec **rappels par mail** chaque matin quand des thèmes sont dus.

## 🚀 Démarrage local

```bash
npm install
npm run dev          # http://localhost:5173
npm run fetch-feeds  # remplit public/data/articles.json avec la veille
npm run fetch-quotes # remplit public/data/quotes.json avec les cotations
npm run build-digest # remplit public/data/digest.json (gratuit, sans clé)
```

## ☁️ Mise en ligne sur GitHub (une seule fois)

1. **Crée un repo** (public ou privé) et pousse le code :
   ```bash
   git init -b main
   git add . && git commit -m "feat: DevWatch initial"
   git remote add origin https://github.com/<ton-pseudo>/devwatch.git
   git push -u origin main
   ```
2. **Active GitHub Pages** : repo → *Settings* → *Pages* → *Source* : **GitHub Actions**.
   Le workflow `deploy.yml` construit et publie le site à chaque push.
   L'appli sera sur `https://<ton-pseudo>.github.io/devwatch/`.
3. **Les données** sont générées au build par `deploy.yml` (veille RSS → résumé → cotations → build → Pages),
   sans aucun commit. Déclenchement : bouton **🔄 Rafraîchir** de l'appli (1 à 2 min), onglet *Actions*
   → *Mise à jour et déploiement* → *Run workflow*, ou un push de code.

## 📧 Rappels par mail (Ebbinghaus)

Le workflow `reminders.yml` tourne chaque matin à 7 h (Paris) : il lit `progress/progress.json`
(synchronisé par l'appli) et t'envoie la liste des thèmes à réviser.

1. **Secrets du repo** (*Settings* → *Secrets and variables* → *Actions* → *New repository secret*) :

   | Secret      | Valeur (exemple Gmail)                          |
   |-------------|--------------------------------------------------|
   | `SMTP_HOST` | `smtp.gmail.com`                                 |
   | `SMTP_PORT` | `465`                                            |
   | `SMTP_USER` | `toi@gmail.com`                                  |
   | `SMTP_PASS` | un [mot de passe d'application](https://myaccount.google.com/apppasswords) (pas ton mot de passe Gmail !) |
   | `MAIL_TO`   | `toi@gmail.com`                                  |

   Optionnel : une *variable* `APP_URL` avec l'URL de ton appli pour avoir le lien dans le mail.
2. **Synchronise ta progression** : dans l'appli → *Paramètres* → renseigne owner/repo/branche
   et un **token fine-grained** limité à ce repo (permissions *Contents : Read and write* et *Actions : Read and write* pour le bouton Rafraîchir).
   Après chaque quiz, la progression est poussée automatiquement dans `progress/progress.json`.
3. Teste : onglet *Actions* → *Rappels Ebbinghaus par mail* → *Run workflow*.

> Le token GitHub reste uniquement dans le localStorage de **ton** navigateur ; il n'est jamais
> commité. Les identifiants SMTP vivent uniquement dans les secrets GitHub.

## 🌍 Actu, géopolitique et marchés — le détail

Trois entrées de plus dans la barre latérale :

| Route | Contenu | Alimenté par |
|-------|---------|--------------|
| `/actu` | Résumé quotidien France / International / Géopolitique, lisible en 5 min | `scripts/build-digest.mjs` → `public/data/digest.json` |
| `/veille/geopolitique` | Veille filtrée sur les think tanks et médias internationaux | `scripts/fetch-feeds.mjs` |
| `/trading` | TTWO, CD Projekt, S&P 500, CAC 40, BTC, SOL + actu des marchés | `scripts/fetch-quotes.mjs` → `public/data/quotes.json` |

La veille accepte désormais un thème dans l'URL : `/veille/<theme>` ouvre la page pré-filtrée.

## 🇫🇷 Tri français d'abord

Chaque flux de `scripts/feeds.json` porte un `lang` (`"fr"` ou `"en"`, défaut dans `defaults`).
`articles.json` est écrit trié **FR d'abord, puis par date décroissante** — le front se contente de filtrer.
Une case « 🇫🇷 français uniquement » complète les filtres.

Trois clés optionnelles par flux :

```json
{ "theme": "actu-fr", "source": "Le Monde", "url": "…", "lang": "fr",
  "maxAgeDays": 3, "maxPerFeed": 12, "digest": true }
```

- `maxAgeDays` / `maxPerFeed` : surchargent `defaults` (l'actu chaude vit 3 jours, pas 45).
- `digest: true` : le flux entre dans le résumé « 5 min ». Sans ça, il n'est que dans la veille.

## ☕ Résumé « actu en 5 min »

Gratuit, sans clé d'API. `build-digest.mjs` prend les dépêches FR `digest: true` de moins de 30 h et :

1. **les regroupe par sujet** en local (similarité TF-IDF titres + chapôs) ; un sujet couvert par
   plusieurs rédactions remonte en tête et affiche « N médias » ;
2. **les fait reformuler** par GitHub Models (palier gratuit, `GITHUB_TOKEN` du workflow avec
   `models: read`, aucun secret à créer). En cas d'échec ou de quota atteint, le chapô de la dépêche
   la plus représentative est utilisé : le résumé est toujours produit.

Variables optionnelles : `DIGEST_MODEL` (défaut `openai/gpt-4o-mini`), `DIGEST_NO_AI=1` pour le mode 100 % local.

## 📈 Cotations

`fetch-quotes.mjs` n'utilise **aucune clé**. Trois sources en cascade :

1. **CoinGecko** pour BTC et SOL (prix + variations, puis `market_chart` pour l'historique 1 an).
2. **Yahoo Finance** `/v8/finance/chart` pour actions et indices (un appel = prix + historique 1 an,
   les variations sont recalculées côté script).
3. **Stooq** (CSV) en filet de sécurité si Yahoo rate-limite.

Si les trois échouent pour un actif, la valeur précédente est conservée et marquée `stale` :
la page affiche « figé » plutôt que de se vider. Le workflow ne tombe jamais en échec pour une
source indisponible.

Chaque actif embarque `series` (clôtures quotidiennes sur 1 an) : l'onglet Marchés en tire des
graphiques 1 M / 3 M / 6 M / 1 an, en SVG sans dépendance (`src/components/PriceChart.vue`).

Devise des cryptos : variable de repo `CRYPTO_VS` (défaut `eur`).

## ⚙️ Workflow

`deploy.yml` fait tout : veille RSS → résumé → cotations → build → déploiement Pages. Les JSON de
`public/data/` ne sont plus commités (`.gitignore`) : plus de commits de bot, et le site affiche
enfin les données fraîches (un commit poussé avec `GITHUB_TOKEN` ne redéclenche pas `deploy.yml`,
donc l'ancien `update.yml` mettait à jour le repo sans republier le site).

Pas de cron : le rafraîchissement se fait à la demande. Les pushes de `progress/**` (sync de la
progression après un quiz) ne redéploient plus le site.

## ⚡ Optimisations de `fetch-feeds.mjs`

- Téléchargement **concurrent** (6 flux en parallèle) + 1 retry à 1,5 s : ~5× plus rapide qu'en série,
  et un flux lent ne bloque plus les autres.
- **Déduplication** par URL normalisée (paramètres `utm_*`/`fbclid` retirés, slash final ignoré) :
  les agrégateurs qui republient le même lien ne polluent plus la grille.
- Le log final indique combien de flux sont revenus vides — les URLs mortes se repèrent en un coup d'œil.

## 🗂️ Structure

```
src/
  views/            # Dashboard, Digest, Trading, Veille, Quiz, QuizSession, Sql, SqlCase, Settings
  data/questions/   # Banques de questions par thème (ajoute les tiennes !)
  data/sqlCases/    # Les enquêtes SQL (schéma + données + étapes + indices)
  lib/spaced.js     # Logique de répétition espacée (Ebbinghaus)
  lib/github.js     # Sync progression → repo GitHub
  lib/sqlEngine.js  # SQLite navigateur (sql.js)
scripts/
  feeds.json        # Sources RSS par thème (personnalise librement)
  fetch-feeds.mjs   # Agrégateur RSS → public/data/articles.json
  fetch-quotes.mjs  # Cotations (CoinGecko / Yahoo / Stooq) → public/data/quotes.json
  build-digest.mjs  # Résumé « actu en 5 min » (regroupement local + GitHub Models) → public/data/digest.json
  send-reminders.mjs# Mail quotidien des thèmes dus
.github/workflows/  # deploy.yml (données + site) · reminders.yml (mail)
```

## ✍️ Personnaliser

- **Ajouter des questions** : édite `src/data/questions/<theme>.js` (format : question, 4 choix,
  index de la bonne réponse, explication, niveau `inter|avance|expert`).
- **Ajouter un flux RSS** : une ligne dans `scripts/feeds.json` (avec `lang`, et `digest: true`
  si le flux doit alimenter le résumé quotidien).
- **Suivre un autre actif** : une entrée dans le tableau `ASSETS` de `scripts/fetch-quotes.mjs`.
- **Ajouter une enquête SQL** : copie un fichier de `src/data/sqlCases/`, déclare-le dans `index.js`.
- **Changer les intervalles Ebbinghaus** : `INTERVALS_DAYS` dans `src/lib/spaced.js`
  (et l'heure du mail dans `reminders.yml`).
