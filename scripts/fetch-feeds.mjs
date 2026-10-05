// Agrège les flux RSS déclarés dans scripts/feeds.json vers public/data/articles.json
// Lancé par .github/workflows/deploy.yml (bouton « Rafraîchir » ou push), ou en local : npm run fetch-feeds
//
// Nouveautés :
//  - `lang` par flux  -> les articles FR remontent en premier (tri lang puis date)
//  - `maxAgeDays` / `maxPerFeed` surchargeables par flux (l'actu chaude vit 3 j, pas 45)
//  - `digest: true`   -> le flux alimente le résumé « 5 min » (scripts/build-digest.mjs)
//  - récupération concurrente (6 en parallèle) + 1 retry : ~5x plus rapide qu'en série
//  - déduplication par URL normalisée (les agrégateurs republient le même lien)
import Parser from 'rss-parser'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(readFileSync(join(root, 'scripts/feeds.json'), 'utf8'))
const DEFAULTS = { lang: 'en', maxPerFeed: 8, maxAgeDays: 45, ...(config.defaults || {}) }
const feeds = config.feeds

const CONCURRENCY = 6

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'DevWatch/1.1 (veille perso)' },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
})

function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Chapô complet pour le résumé « 5 min », coupé proprement sur un mot
function clip(text, max = 400) {
  return text.length <= max ? text : text.slice(0, text.lastIndexOf(' ', max)) + '…'
}

// Image de preview : enclosure RSS, media:content/thumbnail, ou premier <img> du contenu
function extractImage(item) {
  const enc = item.enclosure
  if (enc?.url && /image|\.(png|jpe?g|webp|gif)([?#]|$)/i.test(enc.type || enc.url)) return enc.url
  const mc = (item.mediaContent || []).find((m) => m?.$?.url && (m.$.medium === 'image' || /image/.test(m.$.type || '') || /\.(png|jpe?g|webp|gif)/i.test(m.$.url)))
  if (mc) return mc.$.url
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url
  const html = item.contentEncoded || item['content:encoded'] || item.content || ''
  const m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i)
  if (m && /^https?:\/\//.test(m[1])) return m[1]
  return null
}

// Clé de dédup : URL sans paramètres de tracking ni slash final
const TRACKING = /^(utm_|fbclid|gclid|mc_|ref|ref_src|at_medium|at_campaign)/i
export function dedupKey(link, title) {
  if (!link) return `t:${title.toLowerCase()}`
  try {
    const u = new URL(link)
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k)
    u.hash = ''
    return (u.host + u.pathname.replace(/\/+$/, '') + u.search).toLowerCase()
  } catch {
    return link.toLowerCase()
  }
}

// Pool de promesses : `limit` flux téléchargés en parallèle
async function mapPool(items, limit, fn) {
  const out = new Array(items.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++
        out[i] = await fn(items[i])
      }
    })
  )
  return out
}

async function parseWithRetry(url) {
  try {
    return await parser.parseURL(url)
  } catch (e) {
    await new Promise((r) => setTimeout(r, 1500))
    return parser.parseURL(url) // 2e tentative : laisse remonter l'erreur si elle échoue
  }
}

// Dédup (premier vu gagne) puis tri : FR d'abord, puis du plus récent au plus ancien
export function dedupeAndSort(items) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    const key = dedupKey(item.link, item.title)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  const langRank = (a) => (a.lang === 'fr' ? 0 : 1)
  return out.sort((a, b) => langRank(a) - langRank(b) || new Date(b.date) - new Date(a.date))
}

async function main() {
  const results = await mapPool(feeds, CONCURRENCY, async (feed) => {
    const cfg = { ...DEFAULTS, ...feed }
    try {
      const parsed = await parseWithRetry(feed.url)
      const items = []
      for (const item of (parsed.items || []).slice(0, cfg.maxPerFeed)) {
        const date = item.isoDate || item.pubDate || new Date().toISOString()
        const ageDays = (Date.now() - new Date(date).getTime()) / 86400000
        if (!Number.isFinite(ageDays) || ageDays > cfg.maxAgeDays) continue
        items.push({
          title: (item.title || 'Sans titre').trim(),
          link: item.link,
          date,
          theme: feed.theme,
          themeName: feed.themeName,
          source: feed.source,
          lang: cfg.lang,
          digest: !!cfg.digest,
          summary: clip(stripHtml(item.contentSnippet || item.summary || item.content || '')),
          image: extractImage(item),
        })
      }
      console.log(`✔ ${feed.source.padEnd(24)} ${items.length}/${parsed.items?.length ?? 0} items`)
      return items
    } catch (e) {
      console.warn(`✖ ${feed.source.padEnd(24)} ${e.message}`)
      return []
    }
  })

  const articles = dedupeAndSort(results.flat())

  const outDir = join(root, 'public/data')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    join(outDir, 'articles.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), articles }, null, 1)
  )

  const fr = articles.filter((a) => a.lang === 'fr').length
  const ko = results.filter((r) => r.length === 0).length
  console.log(`\n${articles.length} articles (${fr} FR / ${articles.length - fr} autres) → public/data/articles.json`)
  if (ko) console.log(`${ko} flux sans article (mort, vide ou trop ancien) — voir les ✖ ci-dessus`)
}

// Exécuté seulement en ligne de commande : permet d'importer les helpers dans un test
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
  // rss-parser ne ferme pas les sockets des flux en timeout / 403 : sans exit, Node reste bloqué
  process.exit(0)
}
