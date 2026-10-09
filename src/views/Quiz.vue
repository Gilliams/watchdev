<script setup>
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import { state } from '../stores/progress.js'
import { THEMES } from '../data/themes.js'
import { masteryLabel, INTERVALS_DAYS } from '../lib/spaced.js'
import { questionsFor } from '../data/questions/index.js'
import { pad2 } from '../lib/format.js'

const quizThemes = THEMES.filter((t) => t.quiz)
const sessions = computed(() => Object.values(state.themes).reduce((n, t) => n + (t.history?.length || 0), 0))

// Paliers occupés par au moins un thème (sinon le premier, comme sur la maquette)
const curve = computed(() => {
  const levels = new Set(Object.values(state.themes).map((t) => t.level))
  return INTERVALS_DAYS.map((d, i) => ({
    l: `${d} j`,
    p: i + 1,
    h: `${Math.round(18 + Math.sqrt(d / 120) * 110)}px`,
    on: levels.size ? levels.has(i) : i === 0,
  }))
})

function status(id) {
  const t = state.themes[id]
  if (!t?.nextReview) return 'À découvrir'
  const days = Math.ceil((new Date(t.nextReview).getTime() - Date.now()) / 86400000)
  return days <= 0 ? 'À réviser' : `Dans ${days} j`
}
function detail(id) {
  const t = state.themes[id]
  const n = `${questionsFor(id).length} questions`
  if (!t) return `${n} · jamais testé`
  const last = t.history?.at(-1)
  return `${n} · ${masteryLabel(t.level)}${last ? ` · dernier score ${last.score}/${last.total}` : ''}`
}
</script>

<template>
  <section class="page-hero">
    <div>
      <div class="kicker">{{ quizThemes.length }} thèmes · {{ sessions }} session{{ sessions > 1 ? 's' : '' }}</div>
      <h1 class="hero-title" style="margin-top: 18px">Quiz &amp;<br />Révisions<span class="dot">.</span></h1>
    </div>
    <div class="side">
      <p class="side-p pretty">
        Répétition espacée façon Ebbinghaus : réussis un thème (≥&nbsp;80&nbsp;%) et il s'espace ({{ INTERVALS_DAYS.join(' → ') }}&nbsp;jours). Rate-le (&lt;&nbsp;60&nbsp;%) et il revient dès demain.
      </p>
      <router-link to="/quiz/random" class="btn-acc start">Quiz aléatoire tous thèmes<Icon name="arrow-right" :size="18" /></router-link>
    </div>
  </section>

  <section class="curve-sec band">
    <div class="kicker" style="color: var(--ink); margin-bottom: 18px">La courbe de révision</div>
    <div class="curve">
      <div v-for="c in curve" :key="c.p" class="bar-col">
        <div class="bar" :class="{ on: c.on }" :style="{ height: c.h }"></div>
        <div class="bar-l"><span class="bar-d">{{ c.l }}</span><span class="muted">palier {{ c.p }}</span></div>
      </div>
    </div>
  </section>

  <section class="themes band">
    <router-link v-for="(t, i) in quizThemes" :key="t.id" :to="`/quiz/${t.id}`" class="theme">
      <span class="t-top"><span class="t-n">{{ pad2(i + 1) }}</span><span class="t-s" :class="{ due: status(t.id) === 'À réviser' }">{{ status(t.id) }}</span></span>
      <span class="t-bottom"><span class="t-name">{{ t.name }}</span><span class="t-d">{{ detail(t.id) }}</span></span>
    </router-link>
  </section>
</template>

<style scoped>
.side { display: flex; flex-direction: column; gap: 20px; }
.side-p { font-size: 17px; line-height: 1.45; }
.start { height: 56px; padding: 0 20px; font-size: 16px; }

.curve-sec { padding: 28px var(--pad) 32px; }
.curve { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); align-items: end; gap: 6px; }
.bar-col { display: flex; flex-direction: column; gap: 8px; }
.bar { border: 2px solid var(--ink); background: transparent; }
.bar.on { background: var(--acc); }
.bar-l { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0 6px; font-size: 12px; }
.bar-d { font-weight: 800; }

.themes { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 2px; background: var(--rule); }
.theme { background: var(--bg); color: var(--ink); padding: 24px; min-height: 180px; display: flex; flex-direction: column; justify-content: space-between; gap: 20px; }
.theme:hover { background: var(--acc); color: var(--onacc); }
.t-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; width: 100%; }
.t-n { font-size: 13px; font-weight: 800; opacity: 0.6; }
.t-s { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 7px; border: 1px solid currentColor; }
.t-s.due { background: var(--acc); color: var(--onacc); border-color: var(--acc); }
.theme:hover .t-s.due { background: var(--onacc); color: var(--acc); }
.t-bottom { display: flex; flex-direction: column; gap: 6px; }
.t-name { font-size: 28px; font-weight: 800; letter-spacing: -0.025em; line-height: 1.05; }
.t-d { font-size: 13px; opacity: 0.75; }
</style>
