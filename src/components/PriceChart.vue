<script setup>
// Courbe de cours en SVG pur (pas de dépendance). series : [[ts_s, close], …] triée croissante.
import { computed, ref } from 'vue'

const props = defineProps({
  series: { type: Array, default: () => [] },
  days: { type: Number, default: 90 },
  currency: { type: String, default: null },
})

const W = 300
const H = 100
const PAD = 4

const points = computed(() => {
  const since = Date.now() / 1000 - props.days * 86400
  return props.series.filter(([t]) => t >= since)
})

const change = computed(() => {
  const p = points.value
  return p.length > 1 ? ((p.at(-1)[1] - p[0][1]) / p[0][1]) * 100 : null
})
const color = computed(() => (change.value === null || change.value >= 0 ? 'var(--green)' : 'var(--red)'))

const scaled = computed(() => {
  const p = points.value
  if (p.length < 2) return []
  const closes = p.map(([, c]) => c)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const t0 = p[0][0]
  const span = p.at(-1)[0] - t0 || 1
  return p.map(([t, c]) => ({
    x: ((t - t0) / span) * W,
    y: PAD + (1 - (c - min) / (max - min || 1)) * (H - 2 * PAD),
    t,
    c,
  }))
})

const line = computed(() => scaled.value.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(''))
const area = computed(() => (scaled.value.length ? `${line.value}L${W},${H}L0,${H}Z` : ''))

const hover = ref(null)
function onMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * W
  let best = scaled.value[0]
  for (const p of scaled.value) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p
  hover.value = best
}

const fmtPrice = (v) =>
  new Intl.NumberFormat('fr-FR', {
    style: props.currency ? 'currency' : 'decimal',
    currency: props.currency || undefined,
    maximumFractionDigits: v >= 1000 ? 0 : v >= 10 ? 2 : 4,
  }).format(v)
const fmtDate = (t) => new Date(t * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: props.days > 180 ? '2-digit' : undefined })

</script>

<template>
  <div v-if="scaled.length" class="price-chart">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" @pointermove="onMove" @pointerleave="hover = null" role="img" :aria-label="`Évolution sur ${days} jours : ${change?.toFixed(2)} %`">
      <path :d="area" :fill="color" fill-opacity="0.08" />
      <path :d="line" fill="none" :stroke="color" stroke-width="1.6" vector-effect="non-scaling-stroke" />
      <line v-if="hover" :x1="hover.x" :x2="hover.x" y1="0" :y2="H" stroke="var(--muted)" stroke-dasharray="2 2" vector-effect="non-scaling-stroke" />
    </svg>
    <div v-if="hover" class="tip" :style="{ left: `${Math.min(88, Math.max(12, (hover.x / W) * 100))}%` }">{{ fmtDate(hover.t) }} : {{ fmtPrice(hover.c) }}</div>
    <div class="axis">
      <span>{{ fmtDate(scaled[0].t) }}</span>
      <span>{{ fmtDate(scaled.at(-1).t) }}</span>
    </div>
  </div>
  <div v-else class="price-chart empty">Historique disponible au prochain rafraîchissement</div>
</template>
