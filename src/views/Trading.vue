<script setup>
import { ref, computed, onMounted } from 'vue'
import Icon from '../components/Icon.vue'
import PriceChart from '../components/PriceChart.vue'
import { loadData } from '../lib/data.js'
import { theme } from '../lib/theme.js'
import { pad2, pct, deltaColor, money, dateShort, dateTime, timeHM } from '../lib/format.js'
import { movers as findMovers, marketSummary, matchesAsset } from '../lib/movers.js'

const RANGES = [['1 J', 1], ['1 S', 7], ['1 M', 30], ['6 M', 182], ['1 an', 365]]
const range = ref(30)
const rangeLabel = computed(() => RANGES.find((r) => r[1] === range.value)[0])

const quotes = ref(null)
const news = ref([])
const loading = ref(true)
const newsAsset = ref('all')

onMounted(async () => {
  const [q, a] = await Promise.all([loadData('quotes'), loadData('articles')])
  quotes.value = q
  // Les plus récentes d'abord : sur les marchés, la fraîcheur prime sur la langue
  news.value = (a?.articles || []).filter((x) => x.theme === 'trading').sort((x, y) => new Date(y.date) - new Date(x.date))
  loading.value = false
})

// Variation sur la période affichée, calculée depuis la série
function periodChange(a) {
  if (range.value === 1) return a.changes?.d1
  if (range.value === 7) return a.changes?.d7 // clôture d'il y a 7 j, plus juste que le 1er point filtré
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

const deltas = (a) =>
  [1, 7, 365].includes(range.value) // déjà couverts par 24 h / 7 j / 1 an
    ? [['24 h', a.changes?.d1], ['7 j', a.changes?.d7], ['1 an', a.changes?.y1]]
    : [['24 h', a.changes?.d1], ['7 j', a.changes?.d7], [rangeLabel.value, periodChange(a)]]

// Séance : ouverture / plus haut / plus bas (intraday 5 min)
const dayRow = (a) => (a.day ? [['Ouverture', a.day.open], ['+ haut', a.day.high], ['+ bas', a.day.low]] : [])
const sessionLabel = (a) => {
  if (!a.day) return ''
  if (a.kind === 'crypto') return '24 h glissantes'
  const d = new Date(a.day.to * 1000)
  const today = d.toDateString() === new Date().toDateString()
  return `${today ? 'Séance du jour' : `Séance du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`} · ${timeHM(a.day.from * 1000)}–${timeHM(a.day.to * 1000)}`
}

// Gros mouvements + phrase de synthèse
const moves = computed(() => findMovers(quotes.value?.assets || [], news.value))
const summary = computed(() => marketSummary(quotes.value?.assets || []))
const nameOf = (id) => quotes.value?.assets?.find((a) => a.id === id)?.name || id

// Actu filtrée par actif
const newsChips = computed(() => [
  { id: 'all', l: 'Tout', n: news.value.length },
  ...(quotes.value?.assets || []).map((a) => ({ id: a.id, l: a.name, n: news.value.filter((n) => matchesAsset(n, a.id)).length })).filter((c) => c.n),
])
const newsList = computed(() => (newsAsset.value === 'all' ? news.value : news.value.filter((n) => matchesAsset(n, newsAsset.value))).slice(0, 15))
const tagsOf = (n) => (quotes.value?.assets || []).filter((a) => matchesAsset(n, a.id)).map((a) => a.ticker)
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
        <p class="head-p pretty">Take-Two, CD Projekt, S&amp;P 500, CAC 40, Bitcoin et Solana. Séance du jour par pas de 5 min et historique d'un an, relevés à chaque rafraîchissement — données différées, jamais du temps réel.</p>
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

  <section v-if="!loading && quotes" class="movers band">
    <div class="g-head" style="padding-left: 0; padding-right: 0"><h2 class="g-h">Les gros mouvements</h2><span class="g-c">{{ moves.length }} signal(aux)</span></div>
    <p v-if="summary" class="m-sum pretty">{{ summary }}</p>
    <p v-if="!moves.length" class="m-calm">Rien de marquant : aucun actif ne dépasse les seuils (séance, 7 jours, plus haut/bas annuel, série de hausses ou baisses).</p>
    <div v-else class="m-grid">
      <article v-for="m in moves" :key="m.asset.id" class="m-card">
        <div class="a-top"><span class="a-name">{{ m.asset.name }}</span><span class="a-tk">{{ m.asset.ticker }}</span></div>
        <ul class="m-sig">
          <li v-for="s in m.signals" :key="s.kind" :class="{ neg: /−|baisse|bas/.test(s.text) }">
            <strong>{{ s.text }}</strong><span v-if="s.ctx"> — {{ s.ctx }}</span>
          </li>
        </ul>
        <div v-if="m.news.length" class="m-news">
          <span class="a-dl">Ce qui en parle</span>
          <a v-for="n in m.news" :key="n.link" :href="n.link" target="_blank" rel="noopener">{{ n.title }} <span class="n-m">· {{ n.source }}</span></a>
        </div>
      </article>
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
        <div v-if="a.day" class="a-day">
          <span class="a-dl a-sess">{{ sessionLabel(a) }}</span>
          <div v-for="[l, v] in dayRow(a)" :key="l"><span class="a-dl">{{ l }}</span><span class="a-dd">{{ money(v, a.currency) }}</span></div>
        </div>
        <PriceChart v-if="range === 1" :series="a.intraday || []" intraday :baseline="a.day?.prevClose ?? null" :currency="a.currency" :color="deltaColor(a.changes?.d1)" />
        <PriceChart v-else :series="a.series || []" :days="range" :currency="a.currency" :color="deltaColor(periodChange(a))" />
        <div class="a-src">{{ a.source }} · {{ dateTime(a.asOf) }}<template v-if="a.stale"> · valeur figée, la source n'a pas répondu</template></div>
      </article>
    </div>
  </section>

  <section v-if="news.length" class="news band">
    <h2 class="g-h" style="margin-bottom: 20px">L'actu des marchés</h2>
    <div class="chips">
      <button v-for="c in newsChips" :key="c.id" class="chip" :aria-pressed="newsAsset === c.id" @click="newsAsset = c.id">{{ c.l }}<span class="chip-n">{{ c.n }}</span></button>
    </div>
    <a v-for="(n, i) in newsList" :key="n.link" :href="n.link" target="_blank" rel="noopener" class="n-row">
      <span class="n-n">{{ pad2(i + 1) }}</span>
      <span class="n-col"><span class="n-t">{{ n.title }}</span><span class="n-m">{{ n.source }} · {{ dateTime(n.date) }} · {{ n.lang === 'fr' ? 'FR' : 'EN' }}<template v-for="t in tagsOf(n)" :key="t"> · <b>{{ t }}</b></template></span></span>
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

.a-day { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 4px; }
.a-sess { grid-column: 1 / -1; font-weight: 700; }
.a-day > div { display: flex; flex-direction: column; gap: 2px; }
.a-dd { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }

.movers { padding: 0 var(--pad) 36px; }
.m-sum { font-size: 18px; line-height: 1.45; max-width: 820px; margin-bottom: 20px; }
.m-calm { font-size: 15px; color: var(--mut); }
.m-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); border-top: 2px solid var(--rule); border-left: 2px solid var(--rule); }
.m-card { border-right: 2px solid var(--rule); border-bottom: 2px solid var(--rule); padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; }
.m-sig { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 15px; line-height: 1.35; }
.m-sig li { padding-left: 14px; border-left: 3px solid var(--ink); }
.m-sig li.neg { border-left-color: var(--acc); }
.m-sig li.neg strong { color: var(--acc); }
.m-news { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--hair); padding-top: 12px; }
.m-news a { font-size: 14px; font-weight: 600; line-height: 1.3; color: var(--ink); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.chip { height: 32px; padding: 0 11px; border: 1px solid var(--rule); background: transparent; color: var(--ink); font-size: 13px; font-weight: 600; display: flex; gap: 7px; align-items: center; }
.chip[aria-pressed='true'] { border: 2px solid var(--ink); background: var(--ink); color: var(--bg); }
.chip-n { font-size: 11px; font-weight: 700; opacity: 0.7; }
.news { padding: 40px var(--pad); }
.n-row { display: grid; grid-template-columns: 56px minmax(0, 1fr) 32px; gap: 16px; align-items: baseline; padding: 20px 0; border-top: 2px solid var(--rule); color: var(--ink); }
.n-n { font-size: 15px; font-weight: 800; color: var(--acc); }
.n-col { display: flex; flex-direction: column; gap: 6px; }
.n-t { font-size: clamp(20px, 2.2vw, 26px); font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; }
.n-m { font-size: 12px; color: var(--mut); }
.disclaimer { font-size: 13px; line-height: 1.5; color: var(--mut); padding: 24px var(--pad) 48px; max-width: 760px; }
</style>
