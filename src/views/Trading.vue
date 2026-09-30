<script setup>
import { ref, computed, onMounted } from 'vue'
import { themeColor } from '../data/themes.js'

const quotes = ref(null)
const articles = ref([])
const loading = ref(true)

onMounted(async () => {
  const base = import.meta.env.BASE_URL
  try {
    const res = await fetch(`${base}data/quotes.json`)
    if (res.ok) quotes.value = await res.json()
  } catch { /* pas encore de cotations */ }
  try {
    const res = await fetch(`${base}data/articles.json`)
    if (res.ok) {
      const data = await res.json()
      articles.value = data.articles.filter((a) => a.theme === 'trading').slice(0, 9)
    }
  } catch { /* pas encore de veille */ }
  loading.value = false
})

const groups = computed(() => {
  const all = quotes.value?.assets || []
  return [
    { label: 'Actions', assets: all.filter((a) => a.kind === 'stock') },
    { label: 'Indices', assets: all.filter((a) => a.kind === 'index') },
    { label: 'Crypto', assets: all.filter((a) => a.kind === 'crypto') },
  ].filter((g) => g.assets.length)
})

const staleCount = computed(() => (quotes.value?.assets || []).filter((a) => a.stale).length)

function price(a) {
  const digits = a.price >= 1000 ? 0 : a.price >= 10 ? 2 : 4
  return new Intl.NumberFormat('fr-FR', {
    style: a.currency ? 'currency' : 'decimal',
    currency: a.currency || undefined,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(a.price)
}

function delta(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return { text: '—', cls: 'flat' }
  return { text: `${v >= 0 ? '+' : ''}${v.toFixed(2)} %`, cls: v > 0.05 ? 'up' : v < -0.05 ? 'down' : 'flat' }
}
</script>

<template>
  <h1>📈 Marchés</h1>
  <p class="subtitle">
    Take-Two, CD Projekt, S&amp;P 500, CAC 40, Bitcoin et Solana. Cotations relevées deux fois par jour
    par GitHub Actions — données de clôture ou différées, jamais du temps réel.
    <span v-if="quotes?.generatedAt">Dernier relevé : {{ new Date(quotes.generatedAt).toLocaleString('fr-FR') }}.</span>
  </p>

  <p v-if="loading" class="muted">Chargement…</p>

  <div v-else-if="!quotes" class="card">
    <p style="margin: 0">
      Aucune cotation pour l'instant. Le fichier <code>public/data/quotes.json</code> est généré par le workflow
      <code>markets.yml</code>, ou en local avec <code>npm run fetch-quotes</code>.
    </p>
  </div>

  <template v-else>
    <p v-if="staleCount" class="small" style="color: var(--orange)">
      ⚠️ {{ staleCount }} actif(s) affichent leur dernière valeur connue : la source n'a pas répondu au dernier relevé.
    </p>

    <template v-for="g in groups" :key="g.label">
      <h2>{{ g.label }}</h2>
      <div class="grid">
        <div v-for="a in g.assets" :key="a.id" class="card quote-card" :class="{ stale: a.stale }">
          <div class="flex-between">
            <strong>{{ a.icon }} {{ a.name }}</strong>
            <span class="badge">{{ a.ticker }}</span>
          </div>
          <div class="quote-price">{{ price(a) }}</div>
          <div class="quote-deltas">
            <div v-for="[label, v] in [['24 h', a.changes.d1], ['7 j', a.changes.d7], ['1 an', a.changes.y1]]" :key="label">
              <span class="small muted">{{ label }}</span>
              <span class="delta" :class="delta(v).cls">{{ delta(v).text }}</span>
            </div>
          </div>
          <div class="small muted mt">
            {{ a.source }} · {{ new Date(a.asOf).toLocaleString('fr-FR') }}
            <span v-if="a.stale"> · figé</span>
          </div>
        </div>
      </div>
    </template>
  </template>

  <template v-if="articles.length">
    <h2>📰 L'actu des marchés</h2>
    <div class="grid">
      <div v-for="a in articles" :key="a.link" class="card">
        <a :href="a.link" target="_blank" rel="noopener" style="font-weight: 600">{{ a.title }}</a>
        <div class="small muted">
          {{ a.source }} · {{ new Date(a.date).toLocaleDateString('fr-FR') }}
          <span class="badge" :style="{ color: themeColor('trading'), borderColor: themeColor('trading') }">{{ a.lang === 'fr' ? 'FR' : 'EN' }}</span>
        </div>
        <p v-if="a.summary" class="small muted" style="margin: 0.4rem 0 0">{{ a.summary }}</p>
      </div>
    </div>
  </template>

  <p class="small muted mt">
    Ces chiffres sont indicatifs et fournis sans garantie d'exactitude ni de fraîcheur — ils ne constituent pas
    un conseil en investissement.
  </p>
</template>
