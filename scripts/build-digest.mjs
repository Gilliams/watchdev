// Résumé « actu en 5 min », 100 % gratuit : lit public/data/articles.json, écrit public/data/digest.json.
//
// 1. Regroupement (local, sans IA) : les dépêches FR des dernières 30 h sont regroupées par sujet
//    (similarité TF-IDF des titres + chapôs). Un sujet repris par plusieurs rédactions remonte en tête.
// 2. Rédaction (optionnelle, gratuite) : si GITHUB_TOKEN est présent (workflow avec `models: read`),
//    GitHub Models réécrit chaque sujet en 2-3 phrases. Sinon, ou en cas d'échec, on garde le chapô
//    de la dépêche la plus représentative : le résumé est toujours produit.
//
// Variables optionnelles : DIGEST_MODEL (défaut openai/gpt-4o-mini), DIGEST_NO_AI=1 pour forcer le mode local.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const articlesPath = join(root, 'public/data/articles.json')

const MAX_AGE_HOURS = 30
const MAX_TOPICS = 14
const WORDS_PER_MINUTE = 200
const SIMILARITY = 0.3
const MODEL = process.env.DIGEST_MODEL || 'openai/gpt-4o-mini'
const SECTION_OF = { 'actu-fr': 'France', 'actu-monde': 'International', geopolitique: 'Géopolitique & analyses' }

const STOP = new Set(
  `les des une un le la de du et en au aux pour par sur dans avec ses son sa leur leurs est sont a ont qui que quoi
  dont ou ce cet cette ces il elle ils elles on nous vous pas plus ne se sans sous entre apres avant depuis contre vers
  chez tout tous toute comme mais donc car lors fait faire etre avoir deux trois selon quand alors aussi tres encore
  deja bien peut doit va vont ete etait jour jours annee ans lundi mardi mercredi jeudi vendredi samedi dimanche hier
  demain aujourd hui premier premiere nouveau nouvelle direct video info infos franceinfo article lire suite`.split(/\s+/)
)

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ')
// Troncature à 5 caractères = racinisation grossière mais efficace en français (menace/menacé/menaces)
export const tokens = (s = '') =>
  norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)).map((w) => w.slice(0, 5))

const cleanTitle = (t) => t.replace(/^(.{0,30}\ben direct\b\s*[,:]\s*)/i, '').replace(/^./, (c) => c.toUpperCase())
const short = (t, n = 70) => (t.length <= n ? t : t.slice(0, t.lastIndexOf(' ', n)) + '…')

export function clusterArticles(pool) {
  const docs = pool.map((a) => {
    const tf = {}
    for (const t of tokens(a.title)) tf[t] = (tf[t] || 0) + 2
    for (const t of tokens(a.summary)) tf[t] = (tf[t] || 0) + 1
    return { a, tf, tt: new Set(tokens(a.title)) }
  })
  const df = {}
  for (const d of docs) for (const t in d.tf) df[t] = (df[t] || 0) + 1
  for (const d of docs) {
    d.v = {}
    let n = 0
    for (const t in d.tf) {
      if (df[t] < 2) continue // un terme vu une seule fois ne peut rien rapprocher
      d.v[t] = d.tf[t] * Math.log(docs.length / df[t])
      n += d.v[t] ** 2
    }
    d.n = Math.sqrt(n) || 1
  }

  const clusters = []
  for (const d of docs) {
    let best = null
    let bestSim = 0
    for (const c of clusters) {
      // Garde-fous contre les faux rapprochements : 2 termes communs dont 2 dans les titres
      const shared = Object.keys(d.v).filter((t) => c.v[t]).length
      const sharedTitle = [...d.tt].filter((t) => df[t] >= 2 && c.tt.has(t)).length
      if (shared < 2 || sharedTitle < 2) continue
      const cn = Math.sqrt(Object.values(c.v).reduce((s, x) => s + x * x, 0)) || 1
      let dot = 0
      for (const t in d.v) if (c.v[t]) dot += d.v[t] * c.v[t]
      const sim = dot / (d.n * cn)
      if (sim > bestSim) [best, bestSim] = [c, sim]
    }
    if (best && bestSim >= SIMILARITY) {
      best.docs.push(d)
      for (const t in d.v) best.v[t] = (best.v[t] || 0) + d.v[t] / d.n
      for (const t of d.tt) best.tt.add(t)
    } else {
      const v = {}
      for (const t in d.v) v[t] = d.v[t] / d.n
      clusters.push({ docs: [d], v, tt: new Set(d.tt) })
    }
  }

  return clusters
    .map((c) => {
      const sources = new Set(c.docs.map((d) => d.a.source)).size
      const latest = Math.max(...c.docs.map((d) => new Date(d.a.date).getTime()))
      // Représentant : la dépêche la plus centrale parmi celles qui ont un vrai chapô
      const cn = Math.sqrt(Object.values(c.v).reduce((s, x) => s + x * x, 0)) || 1
      const central = (d) => Object.keys(d.v).reduce((s, t) => s + d.v[t] * (c.v[t] || 0), 0) / (d.n * cn)
      const rep = [...c.docs].sort((x, y) => ((y.a.summary?.length || 0) > 80) - ((x.a.summary?.length || 0) > 80) || central(y) - central(x))[0].a
      const themes = {}
      for (const d of c.docs) themes[d.a.theme] = (themes[d.a.theme] || 0) + 1
      const theme = Object.entries(themes).sort((x, y) => y[1] - x[1])[0][0]
      return { articles: c.docs.map((d) => d.a), sources, latest, rep, theme }
    })
    .sort((x, y) => y.sources - x.sources || y.articles.length - x.articles.length || y.latest - x.latest)
}

async function rewriteWithGithubModels(topics) {
  const token = process.env.GITHUB_TOKEN
  if (!token || process.env.DIGEST_NO_AI) return null
  const corpus = topics
    .map((t, i) => `#${i}\n` + t.articles.slice(0, 3).map((a) => `- ${a.source} : ${a.title}. ${a.summary || ''}`).join('\n'))
    .join('\n\n')
    .slice(0, 18000) // le palier gratuit plafonne l'entrée à ~8k tokens
  const res = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            "Tu rédiges une revue de presse en français, factuelle et neutre. Pour chaque sujet numéroté, écris un titre court et 2 à 3 phrases de fond en n'utilisant QUE les extraits fournis. N'invente rien. " +
            'Réponds uniquement en JSON : {"headline":"une phrase résumant la journée","topics":[{"id":0,"title":"...","body":"..."}]}',
        },
        { role: 'user', content: corpus },
      ],
    }),
  })
  if (!res.ok) throw new Error(`GitHub Models ${res.status} : ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  return JSON.parse(json.choices?.[0]?.message?.content || '{}')
}

export async function main() {
  if (!existsSync(articlesPath)) {
    console.log('public/data/articles.json absent — lance npm run fetch-feeds d\'abord.')
    return
  }
  const { generatedAt, articles } = JSON.parse(readFileSync(articlesPath, 'utf8'))
  const ref = new Date(generatedAt || Date.now()).getTime()
  const pool = articles.filter((a) => a.digest && a.lang === 'fr' && ref - new Date(a.date).getTime() <= MAX_AGE_HOURS * 3600000)
  if (pool.length < 5) {
    console.log(`Seulement ${pool.length} dépêche(s) récente(s) — résumé non régénéré.`)
    return
  }

  const topics = clusterArticles(pool).slice(0, MAX_TOPICS)

  let ai = null
  try {
    ai = await rewriteWithGithubModels(topics)
  } catch (e) {
    console.warn(`✖ Réécriture IA ignorée (${e.message}) — mode extractif.`)
  }
  const aiById = Object.fromEntries((ai?.topics || []).map((t) => [Number(t.id), t]))

  const bySection = {}
  let words = 0
  topics.forEach((t, i) => {
    const w = aiById[i]
    const item = {
      title: w?.title || cleanTitle(t.rep.title),
      body: w?.body || t.rep.summary || '',
      coverage: t.sources,
      date: new Date(t.latest).toISOString(),
      // Un seul lien par rédaction
      sources: [...new Map(t.articles.map((a) => [a.source, a])).values()].map((a) => ({ title: a.title, link: a.link, source: a.source, lang: a.lang })),
    }
    words += item.body.split(/\s+/).filter(Boolean).length + item.title.split(/\s+/).length
    const section = SECTION_OF[t.theme] || 'Autres'
    ;(bySection[section] ||= []).push(item)
  })

  const order = [...Object.values(SECTION_OF), 'Autres']
  const digest = {
    generatedAt: new Date().toISOString(),
    method: ai ? `GitHub Models (${MODEL})` : 'extractif',
    headline: ai?.headline || `À la une : ${topics.slice(0, 3).map((t) => short(cleanTitle(t.rep.title))).join(' · ')}`,
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    articleCount: pool.length,
    sections: order.filter((s) => bySection[s]).map((title) => ({ title, items: bySection[title] })),
  }

  mkdirSync(dirname(articlesPath), { recursive: true })
  writeFileSync(join(dirname(articlesPath), 'digest.json'), JSON.stringify(digest, null, 1))
  console.log(`Résumé écrit (${digest.method}) : ${topics.length} sujets, ~${digest.readingMinutes} min, ${pool.length} dépêches.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
