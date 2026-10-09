<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '../components/Icon.vue'
import { themeById, themesByGroup } from '../data/themes.js'
import { REGIONS, PARIS, region as regionOf, locate } from '../data/regions.js'
import { loadData } from '../lib/data.js'
import { theme } from '../lib/theme.js'
import { isRead, toggleRead, markRead } from '../lib/read.js'
import { dateShort, dateTime } from '../lib/format.js'

const route = useRoute()

const MONDE = themesByGroup('monde')
const ids = new Set(MONDE.map((t) => t.id))
const CHIPS = [['all', 'Tout'], ['geopolitique', 'Géopolitique'], ['actu-monde', 'Actu Monde'], ['actu-fr', 'Actu France'], ['trading', 'Marchés']]

const articles = ref([])
const generatedAt = ref(null)
const loading = ref(true)
const zone = ref(null)
const th = ref(ids.has(route.query.theme) ? route.query.theme : 'all')
const q = ref('')
const hide = ref(false)

onMounted(async () => {
  const data = await loadData('articles')
  // Le fichier est déjà trié : articles francophones d'abord, puis par date
  articles.value = (data?.articles || [])
    .filter((a) => ids.has(a.theme))
    .map((a) => ({ ...a, loc: locate(a) }))
  generatedAt.value = data?.generatedAt || null
  loading.value = false
})

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  return articles.value.filter(
    (a) =>
      (!zone.value || a.loc?.region === zone.value) &&
      (th.value === 'all' || a.theme === th.value) &&
      (!s || a.title.toLowerCase().includes(s)) &&
      (!hide.value || !isRead(a.link))
  )
})
const lead = computed(() => filtered.value[0])
const rest = computed(() => filtered.value.slice(1))
const frCount = computed(() => filtered.value.filter((a) => a.lang === 'fr').length)

// Points chauds : nombre d'articles et lieux les plus cités par zone
const regions = computed(() =>
  REGIONS.map((r) => {
    const inR = articles.value.filter((a) => a.loc?.region === r.id)
    const tally = {}
    for (const a of inR) tally[a.loc.place.name] = (tally[a.loc.place.name] || 0) + 1
    const places = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n)
    return { ...r, count: inR.length, places: places.join(' · ') }
  }).filter((r) => r.count || r.id === zone.value)
)

// Globe : Paris + chaque lieu cité aujourd'hui
const spots = computed(() => {
  const seen = new Map()
  for (const a of articles.value) if (a.loc && !seen.has(a.loc.place.name)) seen.set(a.loc.place.name, a.loc.place.ll)
  return JSON.stringify([PARIS, ...[...seen.values()].slice(0, 14)])
})
const aim = computed(() => (zone.value ? regionOf(zone.value).ll.join(',') : ''))
const aimLabel = computed(() => {
  if (!zone.value) return 'Arcs tracés depuis Paris vers les sujets du jour'
  const r = regions.value.find((x) => x.id === zone.value)
  return `Zone : ${r.label} — ${r.places}`
})

const regLabel = (a) => [a.loc ? regionOf(a.loc.region).label : null, themeById(a.theme)?.name].filter(Boolean).join(' · ')
const regCol = (a) => (zone.value && a.loc?.region === zone.value ? 'var(--acc)' : 'var(--acct)')
</script>

<template>
  <section class="cells band">
    <div class="globe">
      <dw-globe v-if="!loading" :key="spots" class="scene" :theme="theme" :spots="spots" :aim="aim"></dw-globe>
      <div class="globe-title">
        <div class="kicker">Actu &amp; géopolitique<template v-if="generatedAt"> — {{ dateTime(generatedAt) }}</template></div>
        <h1 class="geo-h">Géo&shy;poli&shy;tique<span class="dot">.</span></h1>
      </div>
      <div class="globe-foot"><span>{{ aimLabel }}</span><span>Choisis une zone pour y faire tourner le globe</span></div>
    </div>
    <div class="hot">
      <div class="kicker" style="color: var(--ink); margin-bottom: 16px">Points chauds</div>
      <div class="hot-list">
        <button
          v-for="r in regions"
          :key="r.id"
          class="hot-row"
          :class="{ on: zone === r.id }"
          :aria-pressed="zone === r.id"
          @click="zone = zone === r.id ? null : r.id"
        >
          <span class="hot-col"><span class="hot-l">{{ r.label }}</span><span class="hot-p">{{ r.places }}</span></span>
          <span class="hot-n">{{ r.count }}</span>
        </button>
      </div>
      <p class="hot-note">Flux RSS agrégés à chaque rafraîchissement, articles francophones en tête.</p>
    </div>
  </section>

  <section class="filters band">
    <div class="chips">
      <button v-for="[id, l] in CHIPS" :key="id" class="chip" :aria-pressed="th === id" @click="th = id">{{ l }}</button>
    </div>
    <input v-model="q" class="field search" placeholder="Rechercher un titre…" aria-label="Rechercher un titre" />
    <button class="toggle small-toggle" :aria-pressed="hide" @click="hide = !hide">Masquer les lus</button>
    <span class="count">{{ filtered.length }} article(s) · {{ frCount }} FR</span>
  </section>

  <p v-if="loading" class="empty">Chargement…</p>
  <p v-else-if="!articles.length" class="empty">Aucun article pour l'instant. Clique sur « Rafraîchir ».</p>
  <p v-else-if="!filtered.length" class="empty">Aucun article ne correspond aux filtres.</p>

  <template v-else>
    <article class="lead band" :class="{ 'is-read': isRead(lead.link) }">
      <div class="lead-left">
        <div class="meta"><span class="label" style="color: var(--acct)">{{ regLabel(lead) }}</span><span>{{ lead.source }} · {{ dateShort(lead.date) }}</span></div>
        <h2 class="lead-h">{{ lead.title }}</h2>
      </div>
      <div class="lead-right">
        <p v-if="lead.summary" class="lead-p pretty">{{ lead.summary }}</p>
        <div class="lead-btns">
          <a :href="lead.link" target="_blank" rel="noopener" class="btn-acc lead-open" @click="markRead(lead.link)">Lire l'article<Icon name="arrow-up-right" /></a>
          <button class="chk-wide lead-chk" :aria-pressed="isRead(lead.link)" @click="toggleRead(lead.link)">{{ isRead(lead.link) ? 'Marquer non lu' : 'Marquer comme lu' }}</button>
        </div>
      </div>
    </article>

    <section v-if="rest.length" class="grid band">
      <article v-for="a in rest" :key="a.link" class="card" :class="{ 'is-read': isRead(a.link) }">
        <div class="card-top">
          <span class="label" :style="{ color: regCol(a) }">{{ regLabel(a) }}</span>
          <button class="chk" :aria-pressed="isRead(a.link)" :title="isRead(a.link) ? 'Marquer non lu' : 'Marquer comme lu'" @click="toggleRead(a.link)"><Icon name="check" :size="13" :stroke="2.8" /></button>
        </div>
        <a :href="a.link" target="_blank" rel="noopener" class="card-h pretty" @click="markRead(a.link)">{{ a.title }}</a>
        <p v-if="a.summary" class="card-p pretty">{{ a.summary }}</p>
        <span class="card-src">{{ a.source }} · {{ dateShort(a.date) }}</span>
      </article>
    </section>
  </template>
</template>

<style scoped>
.globe { flex: 7 1 560px; position: relative; min-height: 640px; cursor: grab; overflow: hidden; }
.globe-title { position: absolute; left: var(--pad); top: 36px; pointer-events: none; }
.geo-h { font-size: clamp(56px, 7.5vw, 112px); line-height: 0.9; letter-spacing: -0.05em; margin-top: 14px; font-weight: 800; }
.globe-foot { position: absolute; left: var(--pad); right: var(--pad); bottom: 28px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; font-size: 12px; color: var(--mut); pointer-events: none; }

.hot { flex: 4 1 340px; padding: 36px var(--pad); display: flex; flex-direction: column; }
.hot-list { display: flex; flex-direction: column; border-top: 2px solid var(--rule); }
.hot-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: baseline; padding: 16px 12px; margin: 0 -12px; border: 0; border-bottom: 1px solid var(--hair); background: transparent; color: var(--ink); text-align: left; transition: padding 0.2s; }
.hot-row:hover { padding-left: 18px; }
.hot-row.on { background: var(--acc); color: var(--onacc); }
.hot-col { display: flex; flex-direction: column; gap: 3px; }
.hot-l { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
.hot-p { font-size: 12px; opacity: 0.8; }
.hot-n { font-size: 22px; font-weight: 800; }
.hot-note { margin: auto 0 0; padding-top: 24px; font-size: 13px; line-height: 1.5; color: var(--mut); }

.filters { display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: center; padding: 20px var(--pad); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { height: 34px; padding: 0 12px; border: 2px solid var(--ink); background: transparent; color: var(--ink); font-size: 13px; font-weight: 600; }
.chip[aria-pressed='true'] { background: var(--ink); color: var(--bg); }
.search { flex: 1 1 220px; max-width: 340px; height: 34px; font-size: 14px; }
.small-toggle { height: 34px; padding: 0 12px; }
.count { margin-left: auto; font-size: 13px; color: var(--mut); }

.lead { display: flex; flex-wrap: wrap; gap: 24px 48px; padding: 44px var(--pad); }
.lead-left { flex: 2 1 520px; min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--mut); }
.meta .label { font-size: 12px; }
.lead-h { font-size: clamp(34px, 4.4vw, 60px); line-height: 1; letter-spacing: -0.04em; font-weight: 800; text-wrap: balance; }
.lead-right { flex: 1 1 300px; display: flex; flex-direction: column; gap: 18px; justify-content: flex-end; }
.lead-p { font-size: 18px; line-height: 1.55; }
.lead-btns { display: flex; gap: 10px; flex-wrap: wrap; }
.lead-open { height: 44px; padding: 0 16px; font-size: 14px; justify-content: flex-start; }
.lead-chk { height: 44px; padding: 0 14px; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 2px; background: var(--rule); }
.card { background: var(--bg); padding: 28px clamp(20px, 2.4vw, 32px); display: flex; flex-direction: column; gap: 12px; }
.card-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.card-h { font-size: 22px; line-height: 1.15; letter-spacing: -0.02em; font-weight: 800; color: var(--ink); }
.card-p { font-size: 15px; line-height: 1.5; color: var(--mut); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.card-src { margin-top: auto; font-size: 12px; color: var(--mut); }
</style>
