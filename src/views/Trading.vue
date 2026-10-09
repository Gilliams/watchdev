<script setup>
import { ref, computed, onMounted } from 'vue'
import Icon from '../components/Icon.vue'
import PriceChart from '../components/PriceChart.vue'
import { loadData } from '../lib/data.js'
import { theme } from '../lib/theme.js'
import { pad2, pct, deltaColor, money, dateShort, dateTime } from '../lib/format.js'

const RANGES = [['1 M', 30], ['3 M', 90], ['6 M', 182], ['1 an', 365]]
const range = ref(90)
const rangeLabel = computed(() => RANGES.find((r) => r[1] === range.value)[0])

const quotes = ref(null)
const news = ref([])
const loading = ref(true)

onMounted(async () => {
  const [q, a] = await Promise.all([loadData('quotes'), loadData('articles')])
  quotes.value = q
  news.value = (a?.articles || []).filter((x) => x.theme === 'trading').slice(0, 9)
  loading.value = false
})

// Variation sur la période affichée, calculée depuis la série
function periodChange(a) {
  const since = Date.now() / 1000 - range.value * 86400
  const p = (a.series || []).filter(([t]) => t >= since)
  if (p.length > 1) return ((a.price - p[0][1]) / p[0][1]) * 100
  return range.value === 365 ? a.changes?.y1 : null
}

const groups = computed(() => {
  const all = quotes.value?.assets || []
  return [
    ['Actions', 'stock'],
    ['Indices', 'index'],
    ['Crypto', 'crypto'],
  ]
    .map(([label, kind]) => ({ label, assets: all.filter((a) => a.kind === kind) }))
    .filter((g) => g.assets.length)
})

// Rubans 3D : les 3 derniers mois de chaque actif
const ribbons = computed(() => {
  const since = Date.now() / 1000 - 90 * 86400
  return JSON.stringify((quotes.value?.assets || []).map((a) => (a.series || []).filter(([t]) => t >= since).map(([, c]) => c)))
})

const deltas = (a) => [['24 h', a.changes?.d1], ['7 j', a.changes?.d7], [rangeLabel.value, periodChange(a)]]
</script>

<template>
  <section class="band">
    <div class="head">
      <div class="head-left">
        <div class="kicker">
          <template v-if="quotes?.generatedAt">Dernier relevé : {{ dateTime(quotes.generatedAt) }} — clôture ou différé</template>
          <template v-else>Clôture ou différé</template>
        </div>
        <h1 class="hero-title" style="margin-top: 18px">Marchés<span class="dot">.</span></h1>
      </div>
      <div class="head-right">
        <p class="head-p pretty">Take-Two, CD Projekt, S&amp;P 500, CAC 40, Bitcoin et Solana. Cotations relevées à chaque rafraîchissement — données de clôture ou différées, jamais du temps réel.</p>
        <div class="seg" role="group" aria-label="Période des graphiques">
          <button v-for="[l, d] in RANGES" :key="d" :aria-pressed="range === d" @click="range = d">{{ l }}</button>
        </div>
      </div>
    </div>
    <div class="ribbons">
      <dw-ribbons v-if="!loading" :key="ribbons" class="scene" :theme="theme" :series="ribbons"></dw-ribbons>
      <div class="ribbons-note">Un ruban par actif — rouge quand la tendance est négative</div>
    </div>
  </section>

  <p v-if="loading" class="empty">Chargement…</p>
  <p v-else-if="!quotes" class="empty">Aucune cotation pour l'instant. Clique sur « Rafraîchir », ou en local : <code>npm run fetch-quotes</code>.</p>

  <section v-for="g in groups" :key="g.label" class="band">
    <div class="g-head"><h2 class="g-h">{{ g.label }}</h2><span class="g-c">{{ g.assets.length }} actifs</span></div>
    <div class="g-grid">
      <article v-for="a in g.assets" :key="a.id" class="asset" :class="{ stale: a.stale }">
        <div class="a-top"><span class="a-name">{{ a.name }}</span><span class="a-tk">{{ a.ticker }}</span></div>
        <div class="a-price">{{ money(a.price, a.currency) }}</div>
        <div class="a-deltas">
          <div v-for="[l, v] in deltas(a)" :key="l"><span class="a-dl">{{ l }}</span><span class="a-dv" :style="{ color: deltaColor(v) }">{{ pct(v) }}</span></div>
        </div>
        <PriceChart :series="a.series || []" :days="range" :currency="a.currency" :color="deltaColor(periodChange(a))" />
        <div class="a-src">{{ a.source }} · {{ dateTime(a.asOf) }}<template v-if="a.stale"> · valeur figée, la source n'a pas répondu</template></div>
      </article>
    </div>
  </section>

  <section v-if="news.length" class="news band">
    <h2 class="g-h" style="margin-bottom: 20px">L'actu des marchés</h2>
    <a v-for="(n, i) in news" :key="n.link" :href="n.link" target="_blank" rel="noopener" class="n-row">
      <span class="n-n">{{ pad2(i + 1) }}</span>
      <span class="n-col"><span class="n-t">{{ n.title }}</span><span class="n-m">{{ n.source }} · {{ dateShort(n.date) }} · {{ n.lang === 'fr' ? 'FR' : 'EN' }}</span></span>
      <Icon name="arrow-up-right" :size="20" :stroke="2.2" />
    </a>
  </section>
  <p class="disclaimer">Ces chiffres sont indicatifs et fournis sans garantie d'exactitude ni de fraîcheur — ils ne constituent pas un conseil en investissement.</p>
</template>

<style scoped>
.head { display: flex; flex-wrap: wrap; gap: 20px 48px; justify-content: space-between; align-items: flex-end; padding: 44px var(--pad) 0; }
.head-left { flex: 2 1 480px; min-width: 0; }
.head-right { flex: 1 1 320px; display: flex; flex-direction: column; gap: 16px; align-items: flex-start; }
.head-p { font-size: 16px; line-height: 1.45; color: var(--mut); }
.seg { display: flex; border: 2px solid var(--ink); }
.seg button { height: 38px; padding: 0 18px; border: 0; font-size: 14px; font-weight: 700; background: transparent; color: var(--ink); }
.seg button[aria-pressed='true'] { background: var(--ink); color: var(--bg); }
.ribbons { position: relative; height: 420px; cursor: grab; }
.ribbons-note { position: absolute; left: var(--pad); bottom: 16px; font-size: 12px; color: var(--mut); pointer-events: none; }

.g-head { display: flex; align-items: baseline; gap: 16px; padding: 36px var(--pad) 20px; }
.g-h { font-size: clamp(36px, 4.5vw, 56px); letter-spacing: -0.04em; }
.g-c { font-size: 13px; color: var(--mut); }
.g-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr)); gap: 2px; background: var(--rule); border-top: 2px solid var(--rule); }
.asset { background: var(--bg); padding: 28px clamp(20px, 2.4vw, 36px); display: flex; flex-direction: column; gap: 18px; }
.asset.stale .a-price { color: var(--mut); }
.a-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.a-name { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
.a-tk { font-size: 12px; font-weight: 700; padding: 3px 8px; border: 1px solid var(--rule); }
.a-price { font-size: clamp(44px, 5vw, 64px); font-weight: 800; letter-spacing: -0.045em; line-height: 0.95; }
.a-deltas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 2px solid var(--rule); }
.a-deltas > div { display: flex; flex-direction: column; gap: 2px; padding: 12px 0; }
.a-dl { font-size: 12px; color: var(--mut); }
.a-dv { font-size: 20px; font-weight: 800; }
.a-src { font-size: 12px; color: var(--mut); }

.news { padding: 40px var(--pad); }
.n-row { display: grid; grid-template-columns: 56px minmax(0, 1fr) 32px; gap: 16px; align-items: baseline; padding: 20px 0; border-top: 2px solid var(--rule); color: var(--ink); }
.n-n { font-size: 15px; font-weight: 800; color: var(--acc); }
.n-col { display: flex; flex-direction: column; gap: 6px; }
.n-t { font-size: clamp(20px, 2.2vw, 26px); font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; }
.n-m { font-size: 12px; color: var(--mut); }
.disclaimer { font-size: 13px; line-height: 1.5; color: var(--mut); padding: 24px var(--pad) 48px; max-width: 760px; }
</style>
