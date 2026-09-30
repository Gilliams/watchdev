# 🧠 DevWatch — Actu · Veille · Marchés · Quiz · Enquêtes SQL

Application web personnelle qui concentre cinq outils :

- **☕ L'actu en 5 min** — synthèse quotidienne France / International / Géopolitique, générée par Claude à partir des dépêches des dernières 30 h, avec les liens vers les sources.
- **🌍 Géopolitique** — veille dédiée (Courrier International, Le Grand Continent, IRIS, Diploweb, ECFR, War on the Rocks, Foreign Policy, Carnegie).
- **📈 Marchés** — Take-Two, CD Projekt, S&P 500, CAC 40, Bitcoin et Solana : cours et variations 24 h / 7 j / 1 an, sans aucune clé d'API.
- **📡 Veille technologique** — agrégation automatique de flux RSS (PHP, Symfony, VueJS, Laravel, Sécurité, IA, FrontEnd, 3D, Bases de données, DevOps, Design Patterns, Drupal…) deux fois par jour via GitHub Actions, **articles francophones en tête**.
- **🎯 Quiz de révision** — 60+ questions back-end (niveau intermédiaire → expert) avec explications, pilotées par une **répétition espacée façon courbe d'Ebbinghaus** : un thème réussi à ≥ 80 % s'espace (1 → 3 → 7 → 14 → 30 → 60 → 120 jours), un thème raté (< 60 %) revient dès le lendemain.
- **🕵️ Enquêtes SQL** — trois affaires criminelles à résoudre en vraies requêtes SQL (SQLite dans le navigateur via sql.js) : jointures, agrégations, jointures temporelles, CTE récursives. Indices progressifs si tu bloques, requêtes solutions commentées.

Le tout est **hébergé gratuitement sur GitHub** (Pages + Actions), avec **rappels par mail** chaque matin quand des thèmes sont dus.

## 🚀 Démarrage local

```bash
npm install
npm run dev          # http://localhost:5173
npm run fetch-feeds  # remplit public/data/articles.json avec la veille
npm run fetch-quotes # remplit public/data/quotes.json avec les cotations
npm run build-digest # remplit public/data/digest.json (nécessite ANTHROPIC_API_KEY)
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
3. **Les données** (`update.yml`) sont rafraîchies deux fois par jour — 05:30 et 21:15 UTC — en un
   seul job qui enchaîne veille RSS, résumé d'actu et cotations, puis commite `public/data/*.json`
   (ce qui redéploie le site). Lancement manuel : onglet *Actions* → *Mise à jour quotidienne* →
   *Run workflow*.

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
   et un **token fine-grained** limité à ce repo (permission *Contents : Read and write*).
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

`build-digest.mjs` prend les articles `digest: true` de moins de 30 h, les envoie à Claude et
demande un JSON strict (sections → items → indices des sources). Le script remappe ensuite les
indices vers les vrais liens et recalcule le temps de lecture à partir du nombre de mots réel.

Secret à créer : `ANTHROPIC_API_KEY`
(*Settings* → *Secrets and variables* → *Actions*). Variables optionnelles : `ANTHROPIC_MODEL`
(défaut `claude-sonnet-5`), `DIGEST_MINUTES` (défaut 5).

Sans clé, le script sort en code 0 sans rien écrire : la veille RSS continue de tourner normalement.
Coût indicatif : ~70 titres + chapôs par passage, 4 passages/jour.

## 📈 Cotations

`fetch-quotes.mjs` n'utilise **aucune clé**. Trois sources en cascade :

1. **CoinGecko** pour BTC et SOL (un seul appel, variations 24 h / 7 j / 1 an fournies).
2. **Yahoo Finance** `/v8/finance/chart` pour actions et indices (un appel = prix + historique 1 an,
   les variations sont recalculées côté script).
3. **Stooq** (CSV) en filet de sécurité si Yahoo rate-limite.

Si les trois échouent pour un actif, la valeur précédente est conservée et marquée `stale` :
la page affiche « figé » plutôt que de se vider. Le workflow ne tombe jamais en échec pour une
source indisponible.

Devise des cryptos : variable de repo `CRYPTO_VS` (défaut `eur`).

## ⚙️ Workflow

`update.yml` remplace `veille.yml` (à supprimer) et rend `markets.yml` inutile :
veille RSS → résumé → cotations dans **un seul job**, **un seul commit**, **deux fois par jour**
(05:30 et 21:15 UTC) — soit 2 déploiements Pages par jour.

Le passage du matin intègre la clôture US de la veille, celui du soir se déclenche après la clôture
de Wall Street. L'étape cotations est en `continue-on-error` : une source financière indisponible
ne prive pas le site de sa veille ni de son résumé.

Pour changer de rythme, seuls les deux `cron` sont à toucher ; `workflow_dispatch` reste disponible
pour un rafraîchissement manuel.

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
  build-digest.mjs  # Résumé « actu en 5 min » via Claude → public/data/digest.json
  send-reminders.mjs# Mail quotidien des thèmes dus
.github/workflows/  # deploy.yml · update.yml · reminders.yml
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
