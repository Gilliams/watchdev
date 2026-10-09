<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import { themesByGroup, themeById } from '../data/themes.js'
import { loadData } from '../lib/data.js'
import { theme } from '../lib/theme.js'
import { isRead, toggleRead, markRead } from '../lib/read.js'
import { dateShort } from '../lib/format.js'

const route = useRoute()
const router = useRouter()

const THEMES = themesByGroup('tech')
const ids = new Set(THEMES.map((t) => t.id))

const articles = ref([])
const generatedAt = ref(null)
const loading = ref(true)
// /veille/symfony ouvre la page déjà filtrée
const th = computed(() => (ids.has(route.params.theme) ? route.params.theme : 'all'))
const q = ref('')
const fr = ref(false)
const hide = ref(false)

onMounted(async () => {
  const data = await loadData('articles')
  // articles.json est déjà trié : francophones d'abord, puis par date
  articles.value = (data?.articles || []).filter((a) => ids.has(a.theme))
  generatedAt.value = data?.generatedAt || null
  loading.value = false
})

const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  return articles.value.filter(
    (a) =>
      (th.value === 'all' || a.theme === th.value) &&
      (!fr.value || a.lang === 'fr') &&
      (!hide.value || !isRead(a.link)) &&
      (!s || a.title.toLowerCase().includes(s))
  )
})
const lead = computed(() => list.value[0])
const rest = computed(() => list.value.slice(1))
const frTotal = computed(() => articles.value.filter((a) => a.lang === 'fr').length)
const unread = computed(() => articles.value.filter((a) => !isRead(a.link)).length)

const chips = computed(() =>
  [['all', 'Tous les thèmes'], ...THEMES.map((t) => [t.id, t.name])].map(([id, l]) => ({
    id,
    l,
    n: id === 'all' ? articles.value.length : articles.value.filter((a) => a.theme === id).length,
  }))
)
const select = (id) => router.replace(id === 'all' ? '/veille' : `/veille/${id}`)
const thCol = (a) => (a.theme === 'securite' ? 'var(--acct)' : 'var(--mut)')
const thName = (a) => themeById(a.theme)?.name || a.themeName
const stamp = computed(() => (generatedAt.value ? new Date(generatedAt.value).toLocaleString('fr-FR') : ''))
</script>

<template>
  <section class="cells band">
    <div class="intro">
      <div v-if="stamp" class="kicker">Dernière mise à jour : {{ stamp }}</div>
      <h1 class="hero-title">Veille<br />techno<span class="dot">.</span></h1>
      <p class="intro-p">Flux RSS agrégés à chaque rafraîchissement, articles francophones en tête.</p>
    </div>
    <div class="wave">
      <dw-wave class="scene" :theme="theme"></dw-wave>
      <div class="stats">
        <div><div class="stat-n">{{ articles.length }}</div><div class="stat-l">articles</div></div>
        <div><div class="stat-n">{{ frTotal }}</div><div class="stat-l">en français</div></div>
        <div><div class="stat-n" style="color: var(--acc)">{{ unread }}</div><div class="stat-l">non lus ici</div></div>
      </div>
    </div>
  </section>

  <section class="filters band">
    <div class="chips">
      <button
        v-for="c in chips"
        :key="c.id"
        class="chip"
        :class="{ empty: !c.n && th !== c.id }"
        :aria-pressed="th === c.id"
        @click="select(c.id)"
      >{{ c.l }}<span class="chip-n">{{ c.n }}</span></button>
    </div>
    <div class="row">
      <label class="search">
        <Icon name="search" :size="15" :stroke="2.2" />
        <input v-model="q" placeholder="Rechercher un titre…" aria-label="Rechercher un titre" />
      </label>
      <button class="toggle" :aria-pressed="fr" @click="fr = !fr">Français uniquement</button>
      <button class="toggle" :aria-pressed="hide" @click="hide = !hide">Masquer les lus</button>
      <span class="count">{{ list.length }} article(s) · {{ list.filter((a) => a.lang === 'fr').length }} FR</span>
    </div>
  </section>

  <p v-if="loading" class="empty">Chargement…</p>
  <p v-else-if="!articles.length" class="empty">Aucun article pour l'instant. Clique sur « Rafraîchir », ou lance <code>npm run fetch-feeds</code> en local.</p>
  <p v-else-if="!list.length" class="empty">Aucun article ne correspond aux filtres.</p>

  <template v-else>
    <article class="cells band lead" :class="{ 'is-read': isRead(lead.link) }">
      <a :href="lead.link" target="_blank" rel="noopener" class="visual lead-visual" tabindex="-1" aria-hidden="true" @click="markRead(lead.link)">
        <img referrerpolicy="no-referrer" v-if="lead.image" :src="lead.image" alt="" @error="$event.target.remove()" />
      </a>
      <div class="lead-body">
        <div class="meta"><span class="label" :style="{ color: thCol(lead), fontSize: '12px' }">{{ thName(lead) }}</span><span>{{ lead.source }} · {{ dateShort(lead.date) }}</span><span style="font-weight: 700">{{ lead.lang === 'fr' ? 'FR' : 'EN' }}</span></div>
        <a :href="lead.link" target="_blank" rel="noopener" class="lead-h" @click="markRead(lead.link)">{{ lead.title }}</a>
        <p v-if="lead.summary" class="lead-p">{{ lead.summary }}</p>
        <button class="chk-wide" style="height: 36px" :aria-pressed="isRead(lead.link)" @click="toggleRead(lead.link)">
          <Icon name="check" :stroke="2.6" />{{ isRead(lead.link) ? 'Marquer non lu' : 'Marquer comme lu' }}
        </button>
      </div>
    </article>

    <section v-if="rest.length" class="grid band">
      <article v-for="a in rest" :key="a.link" class="card" :class="{ 'is-read': isRead(a.link) }">
        <a :href="a.link" target="_blank" rel="noopener" class="visual card-visual" tabindex="-1" aria-hidden="true" @click="markRead(a.link)">
          <img referrerpolicy="no-referrer" v-if="a.image" :src="a.image" alt="" loading="lazy" @error="$event.target.remove()" />
          <span class="lang">{{ a.lang === 'fr' ? 'FR' : 'EN' }}</span>
        </a>
        <div class="card-top">
          <span class="label" :style="{ color: thCol(a) }">{{ thName(a) }}</span>
          <button class="chk" :aria-pressed="isRead(a.link)" :title="isRead(a.link) ? 'Marquer non lu' : 'Marquer comme lu'" @click="toggleRead(a.link)"><Icon name="check" :size="13" :stroke="2.8" /></button>
        </div>
        <a :href="a.link" target="_blank" rel="noopener" class="card-h pretty" @click="markRead(a.link)">{{ a.title }}</a>
        <span class="card-src">{{ a.source }} · {{ dateShort(a.date) }}</span>
      </article>
    </section>
  </template>
</template>

<style scoped>
.intro { flex: 3 1 520px; min-width: 0; padding: 44px var(--pad) 36px; display: flex; flex-direction: column; justify-content: flex-end; gap: 20px; }
.intro-p { font-size: 17px; line-height: 1.45; color: var(--mut); max-width: 520px; }
.wave { flex: 2 1 360px; position: relative; min-height: 340px; overflow: hidden; cursor: crosshair; }
.stats { position: absolute; left: 24px; right: 24px; bottom: 20px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); background: var(--bg); border: 2px solid var(--rule); }
.stats > div { padding: 12px 14px; border-right: 1px solid var(--hair); }
.stats > div:last-child { border-right: 0; }
.stat-n { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; }
.stat-l { font-size: 12px; color: var(--mut); }

.filters { padding: 20px var(--pad); display: flex; flex-direction: column; gap: 14px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { height: 32px; padding: 0 11px; border: 1px solid var(--rule); background: transparent; color: var(--ink); font-size: 13px; font-weight: 600; display: flex; gap: 7px; align-items: center; }
.chip[aria-pressed='true'] { border: 2px solid var(--ink); background: var(--ink); color: var(--bg); }
.chip.empty { opacity: 0.45; }
.chip-n { font-size: 11px; font-weight: 700; opacity: 0.7; }
.row { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; }
.search { flex: 1 1 260px; max-width: 420px; display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 12px; border: 2px solid var(--rule); }
.search:focus-within { border-color: var(--ink); }
.search input { flex: 1; min-width: 0; height: 36px; border: 0; background: transparent; color: var(--ink); font-size: 15px; outline: none; }
.count { margin-left: auto; font-size: 13px; color: var(--mut); }

.lead-visual { flex: 1 1 440px; min-height: 340px; display: block; }
.lead-body { flex: 1 1 440px; padding: 36px var(--pad); display: flex; flex-direction: column; gap: 16px; justify-content: flex-end; }
.meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--mut); }
.lead-h { font-size: clamp(32px, 3.8vw, 52px); line-height: 1; letter-spacing: -0.04em; font-weight: 800; color: var(--ink); text-wrap: balance; }
.lead-p { font-size: 17px; line-height: 1.55; color: var(--mut); }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 2px; background: var(--rule); }
.card { background: var(--bg); padding: 20px 20px 24px; display: flex; flex-direction: column; gap: 12px; }
.card-visual { aspect-ratio: 16 / 9; display: block; }
.lang { position: absolute; right: 10px; bottom: 10px; font: 700 11px var(--font); color: var(--ink); background: var(--bg); padding: 1px 5px; }
.card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.card-h { font-size: 19px; line-height: 1.2; letter-spacing: -0.015em; font-weight: 700; color: var(--ink); }
.card-src { margin-top: auto; font-size: 12px; color: var(--mut); }
</style>
