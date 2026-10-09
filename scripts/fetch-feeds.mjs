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

// ---- Image Open Graph (flux sans image : dev.to, CERT-FR, blogs…) ----
// On lit la page de l'article jusqu'à </head> et on prend og:image / twitter:image.
// Cache : les images trouvées au relevé précédent (public/data/articles.json) sont réutilisées,
// et `noImage: true` évite de revisiter une page qui n'en a pas.
const UA = 'Mozilla/5.0 (compatible; DevWatch/1.1; veille perso)'
const OG_CONCURRENCY = 8
const OG_TIMEOUT_MS = 8000
const OG_BUDGET_MS = 60000 // au-delà, on garde les hachures : le build ne doit pas traîner
const OG_MAX_CHARS = 300000

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', '#39': "'", '#x27': "'", '#x2F': '/', '#47': '/' }
const decodeEntities = (s) => s.replace(/&(amp|quot|apos|lt|gt|#39|#x27|#x2F|#47);/gi, (m, k) => ENTITIES[k] ?? ENTITIES[k.toLowerCase()] ?? m)

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'))
  return m ? (m[1] ?? m[2] ?? m[3]) : null
}

export function parseOgImage(html, base) {
  const metas = String(html).match(/<meta\b[^>]*>/gi) || []
  for (const want of ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']) {
    for (const tag of metas) {
      const key = (attr(tag, 'property') || attr(tag, 'name') || '').toLowerCase()
      const content = key === want && attr(tag, 'content')
      if (!content) continue
      try {
        const u = new URL(decodeEntities(content.trim()), base)
        if (/^https?:$/.test(u.protocol)) return u.href
      } catch {}
    }
  }
  return null
}

async function fetchOgImage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal: AbortSignal.timeout(OG_TIMEOUT_MS),
  })
  if (!res.ok || !/html/i.test(res.headers.get('content-type') || '')) {
    res.body?.cancel().catch(() => {})
    return { image: null, final: res.ok } // pas de HTML : inutile de réessayer
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let html = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    html += dec.decode(value, { stream: true })
    if (html.length > OG_MAX_CHARS || /<\/head>/i.test(html)) {
      reader.cancel().catch(() => {})
      break
    }
  }
  return { image: parseOgImage(html, res.url || url), final: true }
}

function previousArticles(file) {
  try {
    return new Map(JSON.parse(readFileSync(file, 'utf8')).articles.map((a) => [a.link, a]))
  } catch {
    return new Map()
  }
}

export async function fillImages(articles, prev) {
  const todo = []
  for (const a of articles) {
    if (a.image || !a.link) continue
    const p = prev.get(a.link)
    if (p?.image) a.image = p.image
    else if (p?.noImage) a.noImage = true
    else todo.push(a)
  }
  const deadline = Date.now() + OG_BUDGET_MS
  let found = 0
  await mapPool(todo, OG_CONCURRENCY, async (a) => {
    if (Date.now() > deadline) return
    try {
      const { image, final } = await fetchOgImage(a.link)
      if (image) { a.image = image; found++ }
      else if (final) a.noImage = true
    } catch {} // timeout, 403… : on réessaiera au prochain relevé
  })
  console.log(`Images og:image : ${found} trouvée(s) sur ${todo.length} page(s) visitée(s)`)
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
  await fillImages(articles, previousArticles(join(outDir, 'articles.json')))
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
