// Détection des gros mouvements de marché, à partir de quotes.json (aucune source externe).
// Chaque signal a un score : plus il est élevé, plus le mouvement est remarquable.
import { ASSET_KEYWORDS, THRESHOLDS } from '../data/assets.js'

const DAY = 86400
const norm = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const fmt = (v) => Math.abs(v).toFixed(1).replace('.', ',') + ' %'

// Rendements journaliers [{ts, r}] ; on écarte le dernier point s'il s'agit de la séance en cours
export function dailyReturns(series, asOf) {
  let s = series || []
  if (s.length && asOf && new Date(s[s.length - 1][0] * 1000).toDateString() === new Date(asOf).toDateString()) s = s.slice(0, -1)
  const out = []
  for (let i = 1; i < s.length; i++) if (s[i - 1][1]) out.push({ ts: s[i][0], r: (s[i][1] / s[i - 1][1] - 1) * 100 })
  return out
}

// Depuis combien de jours n'a-t-on pas vu un mouvement journalier au moins aussi fort, dans le même sens ?
export function daysSinceBigger(returns, move, now = Date.now() / 1000) {
  for (let i = returns.length - 1; i >= 0; i--) {
    const { ts, r } = returns[i]
    if (Math.sign(r) === Math.sign(move) && Math.abs(r) >= Math.abs(move)) return Math.round((now - ts) / DAY)
  }
  return null // jamais sur l'historique disponible
}

export function streak(returns) {
  let n = 0
  const last = returns[returns.length - 1]
  if (!last) return 0
  for (let i = returns.length - 1; i >= 0 && Math.sign(returns[i].r) === Math.sign(last.r); i--) n++
  return n * Math.sign(last.r)
}

export function signalsFor(a, now = Date.now() / 1000) {
  const th = THRESHOLDS[a.kind] || THRESHOLDS.stock
  const d1 = a.changes?.d1
  const d7 = a.changes?.d7
  const out = []
  const rets = dailyReturns(a.series, a.asOf)

  if (Number.isFinite(d1) && Math.abs(d1) >= th.d1) {
    const since = daysSinceBigger(rets, d1, now)
    const verb = d1 > 0 ? 'hausse' : 'baisse'
    let ctx = ''
    if (since === null) ctx = `plus forte ${verb} journalière sur l'historique d'un an`
    else if (since >= 20) ctx = `plus forte ${verb} journalière depuis ${since} jours`
    out.push({ kind: 'd1', score: Math.abs(d1) / th.d1 + (since === null ? 2 : since >= 20 ? 1 : 0), text: `${d1 > 0 ? '+' : '−'}${fmt(d1)} ${a.kind === 'crypto' ? 'en 24 h' : 'sur la séance'}`, ctx })
  }
  if (Number.isFinite(d7) && Math.abs(d7) >= th.d7) {
    out.push({ kind: 'd7', score: (Math.abs(d7) / th.d7) * 0.8, text: `${d7 > 0 ? '+' : '−'}${fmt(d7)} en 7 jours`, ctx: '' })
  }
  const closes = (a.series || []).map(([, c]) => c)
  if (closes.length > 120 && Number.isFinite(a.price)) {
    const hi = Math.max(...closes.slice(0, -1))
    const lo = Math.min(...closes.slice(0, -1))
    if (a.price >= hi * 0.995) out.push({ kind: 'high', score: 1.5, text: a.price >= hi ? 'nouveau plus haut sur 1 an' : 'au contact de son plus haut annuel', ctx: '' })
    if (a.price <= lo * 1.005) out.push({ kind: 'low', score: 1.5, text: a.price <= lo ? 'nouveau plus bas sur 1 an' : 'au contact de son plus bas annuel', ctx: '' })
  }
  // Série en cours, séance du jour comprise (une séance en sens inverse casse la série)
  let st = streak(rets)
  if (Number.isFinite(d1) && Math.abs(d1) > 0.05) st = Math.sign(d1) === Math.sign(st) ? st + Math.sign(d1) : Math.sign(d1)
  if (Math.abs(st) >= 4) out.push({ kind: 'streak', score: Math.min(2, Math.abs(st) / 4), text: `${Math.abs(st)} séances de ${st > 0 ? 'hausse' : 'baisse'} d'affilée`, ctx: '' })
  return out
}

export function matchesAsset(article, id) {
  if (article.asset === id) return true
  const kws = ASSET_KEYWORDS[id] || []
  const txt = ` ${norm(article.title)} ${norm(article.summary || '').slice(0, 300)} `
  return kws.some((k) => new RegExp(`(^|[^a-z0-9])${norm(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(txt))
}

// Gros mouvements triés par importance, avec les actus liées (72 h)
export function movers(assets = [], articles = [], now = Date.now() / 1000) {
  const recent = articles.filter((n) => now - new Date(n.date).getTime() / 1000 < 3 * DAY)
  return assets
    .filter((a) => !a.stale)
    .map((a) => {
      const signals = signalsFor(a, now).sort((x, y) => y.score - x.score)
      const news = recent.filter((n) => matchesAsset(n, a.id)).slice(0, 3)
      return { asset: a, signals, score: signals.reduce((t, s) => t + s.score, 0), news }
    })
    .filter((m) => m.signals.length)
    .sort((x, y) => y.score - x.score)
}

// Une phrase de synthèse du jour
export function marketSummary(assets = []) {
  const live = assets.filter((a) => !a.stale && Number.isFinite(a.changes?.d1))
  if (!live.length) return ''
  const up = live.filter((a) => a.changes.d1 > 0.05)
  const down = live.filter((a) => a.changes.d1 < -0.05)
  const best = [...live].sort((a, b) => b.changes.d1 - a.changes.d1)[0]
  const worst = [...live].sort((a, b) => a.changes.d1 - b.changes.d1)[0]
  const parts = [`${up.length} en hausse, ${down.length} en baisse sur ${live.length} actifs suivis.`]
  if (best.changes.d1 > 0.05) parts.push(`Meilleure séance : ${best.name} (+${fmt(best.changes.d1)}).`)
  if (worst.changes.d1 < -0.05) parts.push(`Plus forte baisse : ${worst.name} (−${fmt(worst.changes.d1)}).`)
  return parts.join(' ')
}
