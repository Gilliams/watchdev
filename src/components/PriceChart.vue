<script setup>
// Courbe de cours (SVG, sans dépendance). series : [[ts_s, close], …] triée croissante.
import { computed, ref } from 'vue'
import { money } from '../lib/format.js'

const props = defineProps({
  series: { type: Array, default: () => [] },
  days: { type: Number, default: 90 },
  currency: { type: String, default: null },
  color: { type: String, default: 'var(--ink)' },
})

const W = 600
const H = 170

const points = computed(() => {
  const since = Date.now() / 1000 - props.days * 86400
  return props.series.filter(([t]) => t >= since)
})

const scaled = computed(() => {
  const p = points.value
  if (p.length < 2) return []
  const v = p.map(([, c]) => c)
  const mn = Math.min(...v)
  const mx = Math.max(...v)
  return p.map(([t, c], k) => ({ x: (k / (p.length - 1)) * W, y: 160 - ((c - mn) / (mx - mn || 1)) * 150, t, c }))
})
const line = computed(() => scaled.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))

const hov = ref(null)
function onMove(e) {
  const b = e.currentTarget.getBoundingClientRect()
  const f = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width))
  hov.value = scaled.value[Math.round(f * (scaled.value.length - 1))] || null
}
const frac = computed(() => (hov.value ? hov.value.x / W : 0))
const fmtDate = (t) => new Date(t * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
</script>

<template>
  <div v-if="scaled.length" class="chart" @mousemove="onMove" @mouseleave="hov = null">
    <svg width="100%" :height="H" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img" :aria-label="`Évolution sur ${days} jours`">
      <line x1="0" :y1="H - 1" :x2="W" :y2="H - 1" stroke="var(--rule)" stroke-width="1" vector-effect="non-scaling-stroke" />
      <polygon :points="`0,${H} ${line} ${W},${H}`" :fill="color" fill-opacity=".09" />
      <polyline :points="line" fill="none" :stroke="color" stroke-width="2" vector-effect="non-scaling-stroke" />
      <line v-if="hov" :x1="hov.x" y1="0" :x2="hov.x" :y2="H" stroke="var(--ink)" stroke-width="1" vector-effect="non-scaling-stroke" />
    </svg>
    <div
      v-if="hov"
      class="tip"
      :style="{ left: `${(frac * 100).toFixed(2)}%`, transform: `translateX(${frac > 0.7 ? '-100%' : frac < 0.15 ? '0%' : '-50%'})` }"
    >
      <span>{{ fmtDate(hov.t) }}</span><span>{{ money(hov.c, currency) }}</span>
    </div>
  </div>
  <div v-else class="chart empty-chart">Historique disponible au prochain rafraîchissement</div>
</template>

<style scoped>
.chart { position: relative; height: 170px; cursor: crosshair; }
.chart svg { display: block; overflow: visible; }
.tip { position: absolute; top: -8px; background: var(--ink); color: var(--bg); padding: 6px 9px; font-size: 12px; font-weight: 700; white-space: nowrap; pointer-events: none; display: flex; gap: 8px; }
.empty-chart { display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--mut); border: 1px dashed var(--rule); cursor: default; }
</style>
