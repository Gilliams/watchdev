// Recommandations YouTube : dernières vidéos des chaînes de scripts/youtube.json -> public/data/videos.json
// Lancé par deploy.yml, ou en local : npm run fetch-youtube
//
// 100 % gratuit, sans clé d'API : chaque chaîne publie un flux Atom public
//   https://www.youtube.com/feeds/videos.xml?channel_id=UC…  (15 dernières vidéos, vues et likes inclus)
// Une chaîne se déclare par son @handle ; l'identifiant UC… est retrouvé sur la page de la chaîne,
// puis gardé en cache dans videos.json (ou fixé à la main via "channelId").
//
// Score de recommandation = surperformance de la vidéo par rapport aux autres vidéos de SA chaîne
// (vues / médiane des vues de la chaîne, corrigé de l'âge), pondérée par le taux de likes et la fraîcheur.
// Une vidéo qui fait 3x l'audience habituelle d'une petite chaîne remonte devant une vidéo moyenne d'une grosse.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(readFileSync(join(root, 'scripts/youtube.json'), 'utf8'))
const outFile = join(root, 'public/data/videos.json')
const DEFAULTS = { maxAgeDays: 30, perChannel: 6, ...(config.defaults || {}) }
const DAY = 86400000

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  Cookie: 'CONSENT=YES+1; SOCS=CAI', // évite la page de consentement européenne
}

async function getText(url) {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }
const decode = (s = '') =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, k) =>
    k[0] === '#' ? String.fromCodePoint(k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : Number(k.slice(1))) : ENT[k.toLowerCase()] ?? m
  )

// ---- @handle -> UC… -------------------------------------------------------
export function parseChannelId(html) {
  const pats = [
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/,
    /<meta itemprop="identifier" content="(UC[\w-]{22})"/,
    /"externalId":"(UC[\w-]{22})"/,
    /feeds\/videos\.xml\?channel_id=(UC[\w-]{22})/,
  ]
  for (const re of pats) {
    const m = html.match(re)
    if (m) return m[1]
  }
  return null
}

async function resolveChannel(ch, cache) {
  if (ch.channelId) return ch.channelId
  if (cache[ch.handle]) return cache[ch.handle]
  const html = await getText(`https://www.youtube.com/${ch.handle.startsWith('@') ? ch.handle : `@${ch.handle}`}`)
  const id = parseChannelId(html)
  if (!id) throw new Error('identifiant de chaîne introuvable sur la page')
  return id
}

// ---- Flux Atom ------------------------------------------------------------
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))
  return m ? decode(m[1].trim()) : ''
}
const attrOf = (xml, name, attr) => {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*\\b${attr}="([^"]*)"`))
  return m ? decode(m[1]) : null
}

export function parseFeed(xml) {
  return (xml.match(/<entry>[\s\S]*?<\/entry>/g) || []).map((e) => {
    const id = tag(e, 'yt:videoId')
    const link = attrOf(e, 'link', 'href') || `https://www.youtube.com/watch?v=${id}`
    const desc = tag(e, 'media:description')
    return {
      id,
      title: tag(e, 'title') || tag(e, 'media:title'),
      url: `https://www.youtube.com/watch?v=${id}`,
      short: /\/shorts\//.test(link),
      published: tag(e, 'published'),
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      views: Number(attrOf(e, 'media:statistics', 'views')) || 0,
      likes: Number(attrOf(e, 'media:starRating', 'count')) || 0,
      description: desc.length > 280 ? desc.slice(0, desc.lastIndexOf(' ', 280)) + '…' : desc,
    }
  })
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}

// Vues attendues à l'âge de la vidéo : l'audience d'une vidéo YouTube se fait surtout les premiers jours,
// on modélise grossièrement une montée en racine carrée qui plafonne vers 14 jours.
const ageFactor = (days) => Math.sqrt(Math.min(Math.max(days, 0.25), 14) / 14)

export function score(videos, now = Date.now()) {
  const ages = videos.map((v) => (now - new Date(v.published).getTime()) / DAY)
  const norm = videos.map((v, i) => v.views / ageFactor(ages[i]))
  const base = median(norm) || 1
  return videos.map((v, i) => {
    const perf = norm[i] / base // 1 = audience habituelle de la chaîne
    const likeRate = v.views ? v.likes / v.views : 0 // ~2-5 % en général
    const fresh = 1 / (1 + ages[i] / 10)
    return { ...v, perf: Number(perf.toFixed(2)), score: Number((perf * (1 + Math.min(likeRate, 0.1) * 10) * fresh).toFixed(3)) }
  })
}

// ---- main -----------------------------------------------------------------
async function main() {
  let previous = {}
  try {
    previous = JSON.parse(readFileSync(outFile, 'utf8'))
  } catch {}
  const cache = { ...(previous.channels || {}) }
  const errors = []
  const videos = []
  const now = Date.now()

  for (const ch of config.channels) {
    const cfg = { ...DEFAULTS, ...ch }
    try {
      const channelId = await resolveChannel(ch, cache)
      cache[ch.handle] = channelId
      const all = parseFeed(await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`)).filter((v) => v.id && !v.short)
      const kept = score(all, now)
        .filter((v) => now - new Date(v.published).getTime() <= cfg.maxAgeDays * DAY)
        .sort((a, b) => b.score - a.score)
        .slice(0, cfg.perChannel)
        .map((v) => ({ ...v, channel: ch.name || ch.handle, handle: ch.handle, category: ch.category, lang: ch.lang || 'en' }))
      videos.push(...kept)
      console.log(`✔ ${(ch.name || ch.handle).padEnd(24)} ${kept.length}/${all.length} vidéos`)
    } catch (e) {
      errors.push(`${ch.handle}: ${e.message}`)
      console.warn(`✖ ${(ch.name || ch.handle).padEnd(24)} ${e.message}`)
      // On garde les vidéos du relevé précédent pour ne pas vider la chaîne sur une panne passagère
      videos.push(...(previous.videos || []).filter((v) => v.handle === ch.handle))
    }
  }

  videos.sort((a, b) => b.score - a.score)
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), categories: config.categories, channels: cache, videos, errors }, null, 1))
  console.log(`\n${videos.length} vidéos (${config.channels.length - errors.length}/${config.channels.length} chaînes) → public/data/videos.json`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
