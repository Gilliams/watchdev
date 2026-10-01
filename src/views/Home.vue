<script setup>
import { computed, ref, onMounted } from 'vue'
import { state } from '../stores/progress.js'
import { THEMES, themeById, themeColor } from '../data/themes.js'
import { dueThemes, themeStatus, masteryLabel } from '../lib/spaced.js'
import { SQL_CASES } from '../data/sqlCases/index.js'
import { loadData } from '../lib/data.js'

const due = computed(() =>
  dueThemes(state)
    .map((id) => themeById(id))
    .filter(Boolean)
)

const neverTested = computed(() =>
  THEMES.filter((t) => t.quiz && !state.themes[t.id])
)

const solvedCases = computed(
  () => SQL_CASES.filter((c) => state.sqlCases[c.id]?.solved).length
)

const totalReviews = computed(() =>
  Object.values(state.themes).reduce((n, t) => n + (t.history?.length || 0), 0)
)

const articles = ref([])
const digest = ref(null)
const quotes = ref(null)

onMounted(async () => {
  const [a, d, q] = await Promise.all([loadData('articles'), loadData('digest'), loadData('quotes')])
  // « Derniers articles de veille » = veille techno uniquement, par date (l'actu a son propre résumé)
  articles.value = (a?.articles || [])
    .filter((x) => themeById(x.theme)?.group === 'tech')
    .sort((x, y) => new Date(y.date) - new Date(x.date))
    .slice(0, 5)
  digest.value = d
  quotes.value = q
})

const topics = computed(() =>
  (digest.value?.sections || []).flatMap((s) => s.items.slice(0, 2).map((i) => i.title)).slice(0, 5)
)

function delta(v) {
  if (!Number.isFinite(v)) return { text: '—', cls: 'flat' }
  return { text: `${v >= 0 ? '+' : ''}${v.toFixed(2)} %`, cls: v > 0.05 ? 'up' : v < -0.05 ? 'down' : 'flat' }
}
</script>

<template>
  <h1>Tableau de bord</h1>
  <p class="subtitle">Ton actu, tes marchés, ta veille, tes révisions et tes enquêtes SQL, au même endroit.</p>

  <!-- Bandeau marchés -->
  <div v-if="quotes?.assets?.length" class="ticker">
    <router-link v-for="a in quotes.assets" :key="a.id" to="/trading" class="ticker-item">
      <span>{{ a.icon }} {{ a.ticker }}</span>
      <span class="delta" :class="delta(a.changes.d1).cls">{{ delta(a.changes.d1).text }}</span>
    </router-link>
  </div>

  <div class="grid">
    <div class="card">
      <h2 style="margin-top: 0">☕ L'actu en {{ digest?.readingMinutes || 5 }} min</h2>
      <template v-if="digest">
        <p style="margin: 0 0 0.6rem">{{ digest.headline }}</p>
        <ul class="small muted" style="margin: 0 0 0.8rem; padding-left: 1.1rem">
          <li v-for="t in topics" :key="t">{{ t }}</li>
        </ul>
        <router-link to="/actu"><button class="primary">Lire le résumé</button></router-link>
      </template>
      <p v-else class="muted small">
        Résumé pas encore généré — clique sur « 🔄 Rafraîchir ».
      </p>
    </div>

    <div class="card">
      <h2 style="margin-top: 0">🔥 À réviser aujourd'hui</h2>
      <p v-if="!due.length && !neverTested.length" class="muted">
        Rien à réviser — la courbe d'Ebbinghaus est de ton côté. 💪
      </p>
      <div v-for="t in due" :key="t.id" class="flex-between" style="margin-bottom: 0.5rem">
        <span>{{ t.icon }} {{ t.name }}</span>
        <router-link :to="`/quiz/${t.id}`"><button class="primary">Réviser</button></router-link>
      </div>
      <div v-if="neverTested.length" class="mt small muted">
        Jamais testés : {{ neverTested.map((t) => t.name).join(', ') }}
      </div>
    </div>

    <div class="card">
      <h2 style="margin-top: 0">📊 Progression</h2>
      <div v-for="t in THEMES.filter((t) => state.themes[t.id])" :key="t.id" class="flex-between" style="margin-bottom: 0.4rem">
        <span class="small">{{ t.icon }} {{ t.name }}</span>
        <span class="badge" :class="themeStatus(state, t.id).cls">
          {{ masteryLabel(state.themes[t.id].level) }}
        </span>
      </div>
      <p v-if="!Object.keys(state.themes).length" class="muted small">
        Lance ton premier quiz pour démarrer le suivi.
      </p>
      <p class="small muted mt">
        {{ totalReviews }} session(s) de quiz · {{ solvedCases }}/{{ SQL_CASES.length }} enquête(s) SQL résolue(s)
      </p>
    </div>
  </div>

  <h2>📡 Derniers articles de veille</h2>
  <p v-if="!articles.length" class="muted small">
    Aucun article pour l'instant — clique sur « 🔄 Rafraîchir », ou lance <code>npm run fetch-feeds</code> en local.
  </p>
  <div v-for="a in articles" :key="a.link" class="card">
    <div class="flex-between">
      <a :href="a.link" target="_blank" rel="noopener">{{ a.title }}</a>
      <span class="badge" :style="{ color: themeColor(a.theme), borderColor: themeColor(a.theme) }">{{ a.themeName }}</span>
    </div>
    <div class="small muted">{{ a.source }} · {{ new Date(a.date).toLocaleDateString('fr-FR') }}</div>
  </div>
  <router-link to="/veille" v-if="articles.length">Toute la veille →</router-link>
</template>
