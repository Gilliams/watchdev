<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { state } from '../stores/progress.js'
import { themeColor, themeIcon, themeById, themesByGroup } from '../data/themes.js'

const route = useRoute()

const articles = ref([])
const loading = ref(true)
const generatedAt = ref(null)
// /veille/geopolitique ouvre la page déjà filtrée sur le thème
const filter = ref(route.params.theme && themeById(route.params.theme) ? route.params.theme : 'all')
const search = ref('')
const hideRead = ref(false)
const frOnly = ref(false)

const techThemes = themesByGroup('tech')
const worldThemes = themesByGroup('monde')

onMounted(async () => {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/articles.json`)
    if (res.ok) {
      const data = await res.json()
      articles.value = data.articles
      generatedAt.value = data.generatedAt
    }
  } catch { /* fichier absent en local avant le premier fetch */ }
  loading.value = false
})

// articles.json est déjà trié FR d'abord puis par date : on se contente de filtrer
const filtered = computed(() =>
  articles.value.filter((a) => {
    if (filter.value !== 'all' && a.theme !== filter.value) return false
    if (frOnly.value && a.lang !== 'fr') return false
    if (hideRead.value && state.readArticles.includes(a.link)) return false
    if (search.value && !a.title.toLowerCase().includes(search.value.toLowerCase())) return false
    return true
  })
)

const frCount = computed(() => filtered.value.filter((a) => a.lang === 'fr').length)

function isRead(link) {
  return state.readArticles.includes(link)
}

function toggleRead(link) {
  const i = state.readArticles.indexOf(link)
  if (i >= 0) state.readArticles.splice(i, 1)
  else state.readArticles.push(link)
}

function markReadOnOpen(link) {
  if (!isRead(link)) state.readArticles.push(link)
}
</script>

<template>
  <h1>{{ filter !== 'all' ? `${themeIcon(filter)} ${themeById(filter)?.name}` : '📡 Veille' }}</h1>
  <p class="subtitle">
    Flux RSS agrégés deux fois par jour par GitHub Actions, articles francophones en tête.
    <span v-if="generatedAt">Dernière mise à jour : {{ new Date(generatedAt).toLocaleString('fr-FR') }}</span>
  </p>

  <div class="flex" style="margin-bottom: 1.2rem">
    <select v-model="filter" style="max-width: 18rem">
      <option value="all">Tous les thèmes</option>
      <optgroup label="Monde">
        <option v-for="t in worldThemes" :key="t.id" :value="t.id">{{ t.icon }} {{ t.name }}</option>
      </optgroup>
      <optgroup label="Tech">
        <option v-for="t in techThemes" :key="t.id" :value="t.id">{{ t.icon }} {{ t.name }}</option>
      </optgroup>
    </select>
    <input type="text" v-model="search" placeholder="Rechercher un titre…" style="max-width: 20rem" />
    <label style="margin: 0; display: flex; align-items: center; gap: 0.4rem; cursor: pointer">
      <input type="checkbox" v-model="frOnly" style="width: auto" /> 🇫🇷 français uniquement
    </label>
    <label style="margin: 0; display: flex; align-items: center; gap: 0.4rem; cursor: pointer">
      <input type="checkbox" v-model="hideRead" style="width: auto" /> masquer les lus
    </label>
    <span class="small muted">{{ filtered.length }} article(s) · {{ frCount }} FR</span>
  </div>

  <p v-if="loading" class="muted">Chargement…</p>
  <div v-else-if="!articles.length" class="card">
    <p>Aucun article pour l'instant. Le fichier <code>public/data/articles.json</code> est généré :</p>
    <ul>
      <li>automatiquement toutes les 6 h par le workflow GitHub <code>veille.yml</code> une fois le repo poussé ;</li>
      <li>ou manuellement avec <code>npm run fetch-feeds</code>.</li>
    </ul>
  </div>
  <p v-else-if="!filtered.length" class="muted">Aucun article ne correspond aux filtres.</p>

  <div class="article-grid">
    <div
      v-for="a in filtered"
      :key="a.link"
      class="card article-card"
      :class="{ 'is-read': isRead(a.link) }"
      :style="{ borderTopColor: themeColor(a.theme) }"
    >
      <div class="thumb" :style="{ background: `linear-gradient(135deg, ${themeColor(a.theme)}22, var(--bg3))` }">
        <span>{{ themeIcon(a.theme) }}</span>
        <img
          v-if="a.image"
          :src="a.image"
          loading="lazy"
          alt=""
          @error="$event.target.style.display = 'none'"
        />
        <span v-if="a.lang === 'fr'" class="lang-flag" title="Article en français">🇫🇷</span>
      </div>
      <div class="article-body">
        <a class="title" :href="a.link" target="_blank" rel="noopener" @click="markReadOnOpen(a.link)">
          {{ a.title }}
        </a>
        <div class="small muted">{{ a.source }} · {{ new Date(a.date).toLocaleDateString('fr-FR') }}</div>
        <p v-if="a.summary" class="summary">{{ a.summary }}</p>
        <div class="flex-between" style="margin-top: auto">
          <span class="badge" :style="{ color: themeColor(a.theme), borderColor: themeColor(a.theme) }">
            {{ a.themeName }}
          </span>
          <button class="small" @click="toggleRead(a.link)" :title="isRead(a.link) ? 'Marquer non lu' : 'Marquer lu'">
            {{ isRead(a.link) ? '↩' : '✓' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
