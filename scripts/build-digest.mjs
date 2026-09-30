// Résumé « actus en 5 min » : lit public/data/articles.json, demande une synthèse à Claude,
// écrit public/data/digest.json. Lancé par .github/workflows/veille.yml après fetch-feeds.
//
// Secret requis : ANTHROPIC_API_KEY (Settings → Secrets and variables → Actions).
// Variables optionnelles : ANTHROPIC_MODEL, DIGEST_MINUTES.
// Sans clé, le script sort en 0 sans rien écrire : le reste de la veille continue de tourner.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const articlesPath = join(root, 'public/data/articles.json')
const outDir = join(root, 'public/data')

const API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'
const MINUTES = Number(process.env.DIGEST_MINUTES || 5)
const WORDS_PER_MINUTE = 200
const MAX_ARTICLES = 70
const MAX_AGE_HOURS = 30

if (!API_KEY) {
  console.log('ANTHROPIC_API_KEY absent — résumé non régénéré (le reste de la veille est inchangé).')
  process.exit(0)
}
if (!existsSync(articlesPath)) {
  console.log('public/data/articles.json absent — lance npm run fetch-feeds d\'abord.')
  process.exit(0)
}

const { articles } = JSON.parse(readFileSync(articlesPath, 'utf8'))

// Sélection : flux marqués `digest: true`, moins de 30 h, FR d'abord (l'ordre du fichier)
const cutoff = Date.now() - MAX_AGE_HOURS * 3600000
const pool = articles
  .filter((a) => a.digest && new Date(a.date).getTime() >= cutoff)
  .slice(0, MAX_ARTICLES)

if (pool.length < 5) {
  console.log(`Seulement ${pool.length} article(s) d'actualité récents — résumé non régénéré.`)
  process.exit(0)
}

const corpus = pool
  .map((a, i) => `[${i}] (${a.themeName} · ${a.source} · ${new Date(a.date).toLocaleString('fr-FR')}) ${a.title}\n${a.summary || ''}`)
  .join('\n\n')

const system = `Tu rédiges la revue de presse quotidienne d'un développeur français.
Tu reçois des titres et chapôs de dépêches (français et anglais) numérotés.
Tu produis une synthèse en FRANÇAIS, lisible en ${MINUTES} minutes (~${MINUTES * WORDS_PER_MINUTE} mots au total).

Règles :
- Regroupe par sujet, pas par source : un même événement couvert par 4 médias = UN seul item.
- Sections, dans cet ordre, en n'en gardant que celles qui ont de la matière : "France", "International", "Géopolitique & analyses", "Économie & marchés".
- 3 à 5 items par section, les plus importants d'abord. Un item = un titre court + 2 à 4 phrases de fond (quoi, pourquoi maintenant, ce que ça implique).
- Factuel et neutre. Signale explicitement quand une information est annoncée par une seule source ou contredite par une autre.
- N'invente rien : uniquement ce qui figure dans les extraits. Si un extrait est trop pauvre, ignore-le.
- Chaque item cite les indices des extraits utilisés dans "sources".

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour et sans balises markdown :
{"headline":"une phrase résumant la journée","sections":[{"title":"France","items":[{"title":"...","body":"...","sources":[0,4]}]}]}`

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': API_KEY,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: `Voici les dépêches des dernières heures :\n\n${corpus}` }],
  }),
})

if (!res.ok) {
  console.error(`Anthropic a répondu ${res.status} : ${(await res.text()).slice(0, 400)}`)
  process.exit(1)
}

const data = await res.json()
const raw = (data.content || [])
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('\n')
  .trim()

let parsed
try {
  parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim())
} catch (e) {
  console.error('Réponse non JSON :', raw.slice(0, 400))
  process.exit(1)
}

// Remplace les indices par les vraies références d'articles + calcule le temps de lecture réel
let words = 0
const sections = (parsed.sections || []).map((s) => ({
  title: s.title,
  items: (s.items || []).map((it) => {
    words += String(it.body || '').split(/\s+/).filter(Boolean).length
    return {
      title: it.title,
      body: it.body,
      sources: (it.sources || [])
        .map((i) => pool[i])
        .filter(Boolean)
        .map((a) => ({ title: a.title, link: a.link, source: a.source, lang: a.lang })),
    }
  }),
}))

const digest = {
  generatedAt: new Date().toISOString(),
  model: MODEL,
  headline: parsed.headline || '',
  readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
  articleCount: pool.length,
  usage: data.usage || null,
  sections,
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'digest.json'), JSON.stringify(digest, null, 1))
console.log(
  `Résumé écrit : ${sections.length} section(s), ${sections.reduce((n, s) => n + s.items.length, 0)} item(s), ` +
    `~${digest.readingMinutes} min de lecture, à partir de ${pool.length} dépêches.`
)
