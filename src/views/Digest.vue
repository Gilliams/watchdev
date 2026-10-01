<script setup>
import { ref, computed, onMounted } from 'vue'
import { loadData } from '../lib/data.js'

const digest = ref(null)
const loading = ref(true)

onMounted(async () => {
  digest.value = await loadData('digest')
  loading.value = false
})

const ageHours = computed(() => {
  if (!digest.value) return 0
  return Math.round((Date.now() - new Date(digest.value.generatedAt).getTime()) / 3600000)
})
</script>

<template>
  <h1>☕ L'actu en {{ digest?.readingMinutes || 5 }} min</h1>
  <p class="subtitle">
    Les sujets des dernières 30 h, regroupés par événement : plus il y a de rédactions qui le couvrent, plus il remonte.
    <span v-if="digest">
      Générée {{ ageHours < 1 ? "il y a moins d'une heure" : `il y a ${ageHours} h` }}
      à partir de {{ digest.articleCount }} dépêches.
    </span>
  </p>

  <p v-if="loading" class="muted">Chargement…</p>

  <div v-else-if="!digest" class="card">
    <p style="margin: 0">
      Aucun résumé pour l'instant. Clique sur « 🔄 Rafraîchir » (ou en local :
      <code>npm run fetch-feeds &amp;&amp; npm run build-digest</code>).
    </p>
  </div>

  <template v-else>
    <div class="card digest-headline">
      <p style="margin: 0">{{ digest.headline }}</p>
    </div>

    <p v-if="ageHours > 20" class="small" style="color: var(--orange)">
      ⚠️ Ce résumé date de plus de 20 h — clique sur « 🔄 Rafraîchir ».
    </p>

    <section v-for="s in digest.sections" :key="s.title">
      <h2>{{ s.title }}</h2>
      <article v-for="(it, i) in s.items" :key="i" class="card digest-item">
        <div class="flex-between">
          <strong>{{ it.title }}</strong>
          <span v-if="it.coverage > 1" class="badge accent" :title="`Sujet repris par ${it.coverage} rédactions`">{{ it.coverage }} médias</span>
        </div>
        <p style="margin: 0.4rem 0 0.6rem">{{ it.body }}</p>
        <div class="digest-sources small">
          <a v-for="src in it.sources" :key="src.link" :href="src.link" target="_blank" rel="noopener" :title="src.title">
            {{ src.source }}
          </a>
        </div>
      </article>
    </section>

    <p class="small muted mt">
      {{ digest.method === 'extractif'
        ? 'Sélection automatique : chaque sujet est présenté par le chapô de la dépêche la plus représentative.'
        : `Textes reformulés par ${digest.method} à partir des titres et chapôs.` }}
      Recoupe avec les sources avant de reprendre une information.
    </p>
  </template>
</template>
