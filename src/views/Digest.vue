<script setup>
import { ref, computed, onMounted } from 'vue'

const digest = ref(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/digest.json`)
    if (res.ok) digest.value = await res.json()
  } catch { /* pas encore de résumé généré */ }
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
    Synthèse des dépêches France / International / Géopolitique des dernières 30 h, regroupées par sujet.
    <span v-if="digest">
      Générée {{ ageHours < 1 ? "il y a moins d'une heure" : `il y a ${ageHours} h` }}
      à partir de {{ digest.articleCount }} dépêches.
    </span>
  </p>

  <p v-if="loading" class="muted">Chargement…</p>

  <div v-else-if="!digest" class="card">
    <p style="margin: 0">
      Aucun résumé pour l'instant. Il est produit par <code>scripts/build-digest.mjs</code> dans le workflow
      <code>veille.yml</code> — vérifie que le secret <code>ANTHROPIC_API_KEY</code> est bien défini, ou lance
      <code>npm run build-digest</code> en local.
    </p>
  </div>

  <template v-else>
    <div class="card digest-headline">
      <p style="margin: 0">{{ digest.headline }}</p>
    </div>

    <p v-if="ageHours > 20" class="small" style="color: var(--orange)">
      ⚠️ Ce résumé date de plus de 20 h — relance le workflow <code>Mise à jour quotidienne</code> pour le rafraîchir.
    </p>

    <section v-for="s in digest.sections" :key="s.title">
      <h2>{{ s.title }}</h2>
      <article v-for="(it, i) in s.items" :key="i" class="card digest-item">
        <strong>{{ it.title }}</strong>
        <p style="margin: 0.4rem 0 0.6rem">{{ it.body }}</p>
        <div class="digest-sources small">
          <a v-for="src in it.sources" :key="src.link" :href="src.link" target="_blank" rel="noopener" :title="src.title">
            {{ src.source }}
          </a>
        </div>
      </article>
    </section>

    <p class="small muted mt">
      Résumé produit automatiquement par {{ digest.model }} à partir des titres et chapôs des flux RSS :
      recoupe toujours avec les sources avant de reprendre une information.
    </p>
  </template>
</template>
