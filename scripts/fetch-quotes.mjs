// Cotations : TTWO, S&P 500, CAC 40, CD Projekt, Bitcoin, Solana -> public/data/quotes.json
// Lancé par .github/workflows/markets.yml (ou en local : npm run fetch-quotes)
//
// Aucune clé d'API. Trois sources, essayées dans l'ordre, la première qui répond gagne :
//   1. CoinGecko  (crypto, officiel, gratuit, sans clé)
//   2. Yahoo Finance /v8/finance/chart (actions + indices, 1 appel = prix + historique 1 an)
//   3. Stooq CSV  (filet de sécurité si Yahoo rate-limit : historique quotidien brut)
// Si tout échoue pour un actif, on conserve la valeur précédente en la marquant `stale`.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/data')
const outFile = join(outDir, 'quotes.json')

const UA = 'Mozilla/5.0 (compatible; DevWatch/1.1; +https://github.com/Gilliams/devwatch)'

export const ASSETS = [
  { id: 'ttwo', name: 'Take-Two Interactive', ticker: 'TTWO', kind: 'stock', icon: '🎮', yahoo: 'TTWO', stooq: ['ttwo.us'] },
  { id: 'cdprojekt', name: 'CD Projekt', ticker: 'CDR.WA', kind: 'stock', icon: '🐺', yahoo: 'CDR.WA', stooq: ['cdr.pl'] },
  { id: 'sp500', name: 'S&P 500', ticker: '^GSPC', kind: 'index', icon: '🇺🇸', yahoo: '^GSPC', stooq: ['^spx'] },
  { id: 'cac40', name: 'CAC 40', ticker: '^FCHI', kind: 'index', icon: '🇫🇷', yahoo: '^FCHI', stooq: ['^cac', '^fchi'] },
  { id: 'bitcoin', name: 'Bitcoin', ticker: 'BTC', kind: 'crypto', icon: '₿', coingecko: 'bitcoin', yahoo: 'BTC-EUR', stooq: ['btceur'] },
  { id: 'solana', name: 'Solana', ticker: 'SOL', kind: 'crypto', icon: '◎', coingecko: 'solana', yahoo: 'SOL-EUR', stooq: ['soleur'] },
]

const VS_CURRENCY = process.env.CRYPTO_VS || 'eur'

async function get(url, type = 'json') {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return type === 'json' ? res.json() : res.text()
}

export const pct = (now, then) => (then ? ((now - then) / then) * 100 : null)

// Dernière clôture <= (maintenant - days), sur une série [{ts, close}] triée croissante
export function closeAgo(series, days) {
  const target = Date.now() - days * 86400000
  let found = null
  for (const p of series) if (p.ts <= target) found = p.close
  return found ?? series[0]?.close ?? null
}

export function changesFromSeries(price, series) {
  const clean = series.filter((p) => Number.isFinite(p.close))
  const prev = clean.length > 1 ? clean[clean.length - 2].close : null
  return {
    d1: pct(price, prev),
    d7: pct(price, closeAgo(clean, 7)),
    y1: pct(price, closeAgo(clean, 365)),
  }
}

/* ---------------------------------------------------------------- CoinGecko */
export async function fromCoinGecko(assets) {
  const ids = assets.map((a) => a.coingecko).join(',')
  const url =
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${VS_CURRENCY}&ids=${ids}` +
    `&price_change_percentage=24h,7d,1y&precision=4`
  const rows = await get(url)
  const out = {}
  for (const row of rows) {
    out[row.id] = {
      price: row.current_price,
      currency: VS_CURRENCY.toUpperCase(),
      asOf: row.last_updated || new Date().toISOString(),
      changes: {
        d1: row.price_change_percentage_24h_in_currency ?? row.price_change_percentage_24h ?? null,
        d7: row.price_change_percentage_7d_in_currency ?? null,
        y1: row.price_change_percentage_1y_in_currency ?? null,
      },
      source: 'coingecko',
    }
  }
  return out
}

/* ------------------------------------------------------------------- Yahoo */
export async function fromYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`
  const json = await get(url)
  const r = json?.chart?.result?.[0]
  if (!r) throw new Error(json?.chart?.error?.description || 'réponse vide')
  const ts = r.timestamp || []
  const closes = r.indicators?.quote?.[0]?.close || []
  const series = ts.map((t, i) => ({ ts: t * 1000, close: closes[i] })).filter((p) => Number.isFinite(p.close))
  const price = r.meta?.regularMarketPrice ?? series[series.length - 1]?.close
  if (!Number.isFinite(price)) throw new Error('pas de prix')
  const ch = changesFromSeries(price, series)
  if (Number.isFinite(r.meta?.chartPreviousClose)) ch.d1 = pct(price, r.meta.chartPreviousClose)
  return {
    price,
    currency: r.meta?.currency || null,
    asOf: r.meta?.regularMarketTime ? new Date(r.meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
    changes: ch,
    source: 'yahoo',
  }
}

/* ------------------------------------------------------------------- Stooq */
export async function fromStooq(symbol) {
  const csv = await get(`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`, 'text')
  const lines = csv.trim().split('\n')
  if (lines.length < 3 || !/^Date/i.test(lines[0])) throw new Error('CSV inattendu')
  const series = lines
    .slice(1)
    .map((l) => l.split(','))
    .filter((c) => c.length >= 5)
    .map((c) => ({ ts: new Date(c[0]).getTime(), close: Number(c[4]) }))
    .filter((p) => Number.isFinite(p.close))
    .slice(-400)
  const price = series[series.length - 1]?.close
  if (!Number.isFinite(price)) throw new Error('pas de prix')
  return {
    price,
    currency: null,
    asOf: new Date(series[series.length - 1].ts).toISOString(),
    changes: changesFromSeries(price, series),
    source: 'stooq',
  }
}

/* -------------------------------------------------------------------- main */
export async function main() {
  const previous = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : { assets: [] }
  const prevById = Object.fromEntries((previous.assets || []).map((a) => [a.id, a]))

  let crypto = {}
  const cryptoAssets = ASSETS.filter((a) => a.coingecko)
  try {
    crypto = await fromCoinGecko(cryptoAssets)
  } catch (e) {
    console.warn(`✖ CoinGecko : ${e.message} — repli sur Yahoo pour les cryptos`)
  }

  const assets = []
  const errors = []

  for (const asset of ASSETS) {
    const base = { id: asset.id, name: asset.name, ticker: asset.ticker, kind: asset.kind, icon: asset.icon }
    let quote = crypto[asset.coingecko] || null
    const tried = []

    if (!quote && asset.yahoo) {
      try {
        quote = await fromYahoo(asset.yahoo)
      } catch (e) {
        tried.push(`yahoo:${e.message}`)
      }
    }
    if (!quote) {
      for (const s of asset.stooq || []) {
        try {
          quote = await fromStooq(s)
          break
        } catch (e) {
          tried.push(`stooq(${s}):${e.message}`)
        }
      }
    }

    if (quote) {
      assets.push({ ...base, ...quote, stale: false })
      const d1 = quote.changes.d1
      console.log(`✔ ${asset.name.padEnd(22)} ${quote.price} ${quote.currency || ''} ${d1 == null ? '' : `(${d1.toFixed(2)} % j)`} [${quote.source}]`)
    } else if (prevById[asset.id]) {
      assets.push({ ...prevById[asset.id], stale: true })
      errors.push(`${asset.id}: ${tried.join(' | ')}`)
      console.warn(`↺ ${asset.name.padEnd(22)} valeur précédente conservée — ${tried.join(' | ')}`)
    } else {
      errors.push(`${asset.id}: ${tried.join(' | ')}`)
      console.warn(`✖ ${asset.name.padEnd(22)} ${tried.join(' | ')}`)
    }
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), vsCurrency: VS_CURRENCY.toUpperCase(), assets, errors }, null, 1))
  console.log(`\n${assets.filter((a) => !a.stale).length}/${ASSETS.length} cotations fraîches → public/data/quotes.json`)

  // On ne casse jamais le workflow pour une source indisponible : le front affiche « donnée figée ».
  return assets
}

// Exécuté seulement en ligne de commande : permet d'importer les helpers dans un test
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
