<script setup>
// Courbe de cours (SVG, sans dépendance) avec axes : prix en ordonnée (à droite), dates/heures en abscisse.
// series : [[ts_s, close], …] triée croissante.
// intraday : la série est déjà la séance du jour (pas de filtre par période, heures en abscisse).
// baseline : clôture de la veille, tracée en pointillés.
import { computed, ref } from 'vue'
import { money } from '../lib/format.js'

const props = defineProps({
  series: { type: Array, default: () => [] },
  days: { type: Number, default: 90 },
  currency: { type: String, default: null },
  color: { type: String, default: 'var(--ink)' },
  intraday: { type: Boolean, default: false },
  baseline: { type: Number, default: null },
})

const W = 600
const H = 170
const Y_TICKS = 4
const X_TICKS = 5

const points = computed(() => {
  if (props.intraday) return props.series
  const since = Date.now() / 1000 - props.days * 86400
  return props.series.filter(([t]) => t >= since)
})

// Graduations « rondes » : pas de 1, 2, 2,5 ou 5 × 10^n
function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw))
  const f = raw / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
}

const scale = computed(() => {
  const v = points.value.map(([, c]) => c)
  if (props.intraday && Number.isFinite(props.baseline)) v.push(props.baseline)
  if (v.length < 2) return null
  let mn = Math.min(...v)
  let mx = Math.max(...v)
  if (mx === mn) { mn -= Math.abs(mn) * 0.01 || 1; mx += Math.abs(mx) * 0.01 || 1 }
  const step = niceStep((mx - mn) / Y_TICKS)
  const lo = Math.floor(mn / step) * step
  const hi = Math.ceil(mx / step) * step
  const ticks = []
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Number(t.toPrecision(12)))
  return { lo, hi, step, ticks }
})

const yOf = (c) => H - ((c - scale.value.lo) / (scale.value.hi - scale.value.lo || 1)) * H

const scaled = computed(() => {
  const p = points.value
  if (p.length < 2 || !scale.value) return []
  return p.map(([t, c], k) => ({ x: (k / (p.length - 1)) * W, y: yOf(c), t, c }))
})
const line = computed(() => scaled.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))

const decimals = computed(() => (scale.value ? Math.min(4, (String(scale.value.step).split('.')[1] || '').length) : 0))
const fmtNum = (v) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals.value, maximumFractionDigits: decimals.value }).format(v)
const yTicks = computed(() => (scale.value ? scale.value.ticks.map((v) => ({ v, label: fmtNum(v), top: (yOf(v) / H) * 100 })) : []))

const fmtTime = (t) => new Date(t * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const fmtDate = (t) =>
  new Date(t * 1000).toLocaleDateString('fr-FR', props.days > 200 ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })
const fmtTip = (t) => (props.intraday ? fmtTime(t) : new Date(t * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }))

// Abscisse indexée (jours de bourse consécutifs) : on étiquette des points répartis régulièrement
const xTicks = computed(() => {
  const s = scaled.value
  if (s.length < 2) return []
  const out = []
  for (let i = 0; i < X_TICKS; i++) {
    const p = s[Math.round((i / (X_TICKS - 1)) * (s.length - 1))]
    out.push({ left: (p.x / W) * 100, label: props.intraday ? fmtTime(p.t) : fmtDate(p.t), edge: i === 0 ? 'start' : i === X_TICKS - 1 ? 'end' : 'mid' })
  }
  return out
})

const baseY = computed(() => (props.intraday && Number.isFinite(props.baseline) && scale.value ? yOf(props.baseline) : null))

const hov = ref(null)
function onMove(e) {
  const b = e.currentTarget.getBoundingClientRect()
  const f = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width))
  hov.value = scaled.value[Math.round(f * (scaled.value.length - 1))] || null
}
const frac = computed(() => (hov.value ? hov.value.x / W : 0))
</script>

<template>
  <figure v-if="scaled.length" class="pc">
    <div class="plot" @mousemove="onMove" @mouseleave="hov = null">
      <svg width="100%" :height="H" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img" :aria-label="intraday ? 'Évolution sur la séance' : `Évolution sur ${days} jours`">
        <line v-for="t in yTicks" :key="t.v" x1="0" :y1="(t.top / 100) * H" :x2="W" :y2="(t.top / 100) * H" stroke="var(--hair)" stroke-width="1" vector-effect="non-scaling-stroke" />
        <line v-if="baseY !== null" x1="0" :y1="baseY" :x2="W" :y2="baseY" stroke="var(--mut)" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" />
        <polygon :points="`0,${H} ${line} ${W},${H}`" :fill="color" fill-opacity=".09" />
        <polyline :points="line" fill="none" :stroke="color" stroke-width="2" vector-effect="non-scaling-stroke" />
        <line v-if="hov" :x1="hov.x" y1="0" :x2="hov.x" :y2="H" stroke="var(--ink)" stroke-width="1" vector-effect="non-scaling-stroke" />
      </svg>
      <div
        v-if="hov"
        class="tip"
        :style="{ left: `${(frac * 100).toFixed(2)}%`, transform: `translateX(${frac > 0.7 ? '-100%' : frac < 0.15 ? '0%' : '-50%'})` }"
      >
        <span>{{ fmtTip(hov.t) }}</span><span>{{ money(hov.c, currency) }}</span>
      </div>
    </div>
    <div class="y-axis" aria-hidden="true">
      <span v-for="t in yTicks" :key="t.v" class="y-l" :style="{ top: `${t.top}%` }">{{ t.label }}</span>
    </div>
    <div class="x-axis" aria-hidden="true">
      <span v-for="t in xTicks" :key="t.left" class="x-l" :class="t.edge" :style="{ left: `${t.left}%` }">{{ t.label }}</span>
    </div>
    <figcaption class="axis-titles">
      <span>{{ intraday ? 'Heure (Paris)' : 'Date' }}</span>
      <span v-if="baseY !== null" class="base-key">--- clôture veille {{ money(baseline, currency) }}</span>
      <span>Prix{{ currency ? ` (${currency})` : '' }}</span>
    </figcaption>
  </figure>
  <div v-else class="pc empty-chart">{{ intraday ? 'Séance du jour disponible au prochain rafraîchissement' : 'Historique disponible au prochain rafraîchissement' }}</div>
</template>

<style scoped>
.pc { display: grid; grid-template-columns: minmax(0, 1fr) 72px; grid-template-rows: 170px 22px auto; margin: 0; }
.plot { position: relative; cursor: crosshair; border-bottom: 1px solid var(--rule); border-right: 1px solid var(--rule); }
.plot svg { display: block; overflow: visible; }
.y-axis { position: relative; }
.y-l { position: absolute; left: 8px; transform: translateY(-50%); font-size: 11px; font-variant-numeric: tabular-nums; color: var(--mut); white-space: nowrap; }
.x-axis { position: relative; grid-column: 1; }
.x-l { position: absolute; top: 5px; transform: translateX(-50%); font-size: 11px; color: var(--mut); white-space: nowrap; }
.x-l.start { transform: none; }
.x-l.end { transform: translateX(-100%); }
.axis-titles { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 12px; font-size: 11px; font-weight: 700; color: var(--mut); }
.base-key { font-weight: 400; }
.tip { position: absolute; top: -8px; background: var(--ink); color: var(--bg); padding: 6px 9px; font-size: 12px; font-weight: 700; white-space: nowrap; pointer-events: none; display: flex; gap: 8px; }
.empty-chart { display: flex; align-items: center; justify-content: center; height: 170px; font-size: 12px; color: var(--mut); border: 1px dashed var(--rule); }
</style>
