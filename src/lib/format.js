// Formateurs partagés (dates, variations, prix) — typographie française

export const pad2 = (n) => String(n).padStart(2, '0')

export function pct(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2).replace('.', ',') + ' %'
}

// Rouge si négatif, encre sinon (règle des maquettes)
export const deltaColor = (v) => (Number.isFinite(v) && v < -0.05 ? 'var(--acc)' : 'var(--ink)')

export function money(v, cur) {
  if (!Number.isFinite(v)) return '—'
  const dg = v >= 1000 ? 0 : v >= 10 ? 2 : 4
  return new Intl.NumberFormat('fr-FR', {
    style: cur ? 'currency' : 'decimal',
    currency: cur || undefined,
    minimumFractionDigits: dg,
    maximumFractionDigits: dg,
  }).format(v)
}

export const dateShort = (d) => new Date(d).toLocaleDateString('fr-FR')
export const dateTime = (d) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
export const timeHM = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

// « Mercredi 7 octobre 2026 »
export function longDate(d = new Date()) {
  const s = new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function hoursAgo(d) {
  const h = Math.round((Date.now() - new Date(d).getTime()) / 3600000)
  return h < 1 ? "il y a moins d'une heure" : `il y a ${h} h`
}

// Segments texte / `code` / **gras** (questions, explications, récits)
export function segs(text) {
  return String(text || '')
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith('`') && p.endsWith('`') && p.length > 1) return { t: p.slice(1, -1), kind: 'code' }
      if (p.startsWith('**') && p.endsWith('**')) return { t: p.slice(2, -2), kind: 'bold' }
      return { t: p, kind: 'plain' }
    })
}

// Mini-courbe : points SVG à partir d'une série [[ts, close], …]
export function sparkPoints(series, w, h, days = 90) {
  const since = Date.now() / 1000 - days * 86400
  let p = (series || []).filter(([t]) => t >= since)
  if (p.length < 2) p = series || []
  if (p.length < 2) return ''
  const v = p.map(([, c]) => c)
  const mn = Math.min(...v)
  const mx = Math.max(...v)
  return v
    .map((y, i) => `${((i / (v.length - 1)) * w).toFixed(1)},${(h - 2 - ((y - mn) / (mx - mn || 1)) * (h - 4)).toFixed(1)}`)
    .join(' ')
}
