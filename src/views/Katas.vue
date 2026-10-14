<script setup>
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import { state } from '../stores/progress.js'
import { KATAS, UPCOMING } from '../data/katas/index.js'
import { INTERVALS_DAYS, reviewStatus, masteryLabel } from '../lib/spaced.js'
import { pad2, duration } from '../lib/format.js'

const practiced = computed(() => KATAS.filter((k) => state.katas[k.id]).length)

function detail(k) {
  const t = state.katas[k.id]
  if (!t) return `${k.steps.length} étapes · jamais pratiqué`
  const times = t.history.filter((h) => !h.revealed && h.ms).map((h) => h.ms)
  const best = times.length ? ` · record ${duration(Math.min(...times))}` : ''
  return `${t.history.length} répétition${t.history.length > 1 ? 's' : ''} · ${masteryLabel(t.level)}${best}`
}
</script>

<template>
  <section class="page-hero">
    <div>
      <div class="kicker">{{ KATAS.length }} katas · {{ practiced }} pratiqué{{ practiced > 1 ? 's' : '' }} · PHP 8.4</div>
      <h1 class="hero-title" style="margin-top: 18px">Katas<br />Patterns<span class="dot">.</span></h1>
    </div>
    <p class="intro pretty">
      Un kata, c'est le même exercice refait jusqu'à ce qu'il devienne un réflexe. Chacun se joue en deux temps : refactoriser un code existant, puis y ajouter
      une fonctionnalité que le pattern rend triviale. Ton code tourne en vrai PHP dans le navigateur. Réussi sans aide, le kata s'espace
      ({{ INTERVALS_DAYS.join(' → ') }}&nbsp;jours) ; avec un indice il garde son palier ; solution affichée, il revient demain.
    </p>
  </section>

  <section>
    <router-link v-for="(k, i) in KATAS" :key="k.id" :to="`/katas/${k.id}`" class="kata">
      <span class="n">{{ pad2(i + 1) }}</span>
      <span class="mid">
        <span class="t">{{ k.name }}</span>
        <span class="sk">{{ k.nameFr }} · {{ k.family }} — {{ k.summary }}</span>
      </span>
      <span class="end">
        <span class="lvl" :class="{ due: reviewStatus(state.katas[k.id]).due }">{{ reviewStatus(state.katas[k.id]).label }}</span>
        <span class="pr">{{ detail(k) }}</span>
      </span>
    </router-link>
  </section>

  <section class="upcoming">
    <div class="kicker" style="color: var(--ink)">À venir</div>
    <p class="muted" style="font-size: 14px">
      Classés par utilité en PHP/Symfony. Chaque lien mène à la fiche de refactoring.guru, la référence dont s'inspire cette section.
    </p>
    <div class="up-list">
      <a v-for="u in UPCOMING" :key="u.name" :href="u.guru" target="_blank" rel="noopener" class="tag up">{{ u.name }}<Icon name="arrow-up-right" :size="11" /></a>
    </div>
  </section>
</template>

<style scoped>
.intro { font-size: 17px; line-height: 1.5; }
.kata { width: 100%; display: grid; grid-template-columns: clamp(56px, 8vw, 120px) minmax(0, 1fr) auto; gap: 20px; align-items: center; padding: 28px var(--pad); border-bottom: 2px solid var(--rule); color: var(--ink); }
.kata:hover { background: var(--acc); color: var(--onacc); }
.n { font-size: clamp(36px, 5vw, 64px); font-weight: 800; letter-spacing: -0.05em; opacity: 0.35; }
.mid { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.t { font-size: clamp(26px, 3.4vw, 44px); font-weight: 800; letter-spacing: -0.035em; line-height: 1.02; }
.sk { font-size: 14px; opacity: 0.75; }
.end { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.lvl { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 8px; border: 1px solid currentColor; white-space: nowrap; }
.lvl.due { background: var(--acc); color: var(--onacc); border-color: var(--acc); }
.kata:hover .lvl.due { background: var(--onacc); color: var(--acc); }
.pr { font-size: 12px; opacity: 0.75; white-space: nowrap; }
.upcoming { padding: 32px var(--pad) 48px; display: flex; flex-direction: column; gap: 12px; }
.up-list { display: flex; flex-wrap: wrap; gap: 8px; }
.up { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--mut); }
.up:hover { color: var(--ink); border-color: var(--ink); }
@media (max-width: 640px) {
  .kata { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .n { display: none; }
  .end { align-items: flex-start; }
  .pr { white-space: normal; }
}
</style>
