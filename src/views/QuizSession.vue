<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import { state } from '../stores/progress.js'
import { themeById } from '../data/themes.js'
import { pickQuestions } from '../data/questions/index.js'
import { recordQuizResult, INTERVALS_DAYS } from '../lib/spaced.js'
import { pushQuietly } from '../lib/github.js'
import { segs, dateShort } from '../lib/format.js'

const route = useRoute()
const router = useRouter()
const themeId = route.params.theme
const isRandom = themeId === 'random'
const title = isRandom ? 'Quiz aléatoire' : themeById(themeId)?.name || themeId

const questions = ref(pickQuestions(themeId, isRandom ? 12 : 8))
const idx = ref(0)
const sel = ref(null) // index | 'idk' | null
const revealed = ref(false)
const score = ref(0)
const hist = ref([])
const finished = ref(false)
const result = ref(null)

const q = computed(() => questions.value[idx.value] || { choices: [] })
const total = computed(() => questions.value.length || 1)

// Texte de question/explication : blocs ```code``` séparés, puis `code` et **gras** en ligne
function parts(text) {
  return String(text || '')
    .split(/```(?:\w+)?\n?/)
    .map((t, i) => ({ code: i % 2 === 1, t: t.trim() }))
    .filter((p) => p.t)
    .map((p) => (p.code ? p : { ...p, segs: segs(p.t) }))
}

const LV = { inter: ['Intermédiaire', 'var(--sf)', 'var(--ink)'], avance: ['Avancé', 'var(--ink)', 'var(--bg)'], expert: ['Expert', 'var(--acc)', 'var(--onacc)'] }
const lvl = computed(() => LV[q.value.level] || ['', 'transparent', 'var(--ink)'])
const tagName = computed(() => (isRandom ? themeById(q.value.theme)?.name : title))

function choiceStyle(i) {
  const s = sel.value === i
  const right = revealed.value && i === q.value.answer
  const wrong = revealed.value && s && i !== q.value.answer
  return {
    borderColor: right ? 'var(--ink)' : wrong ? 'var(--acc)' : s ? 'var(--ink)' : 'var(--rule)',
    background: right ? 'var(--ink)' : wrong ? 'var(--acc)' : s ? 'var(--sf)' : 'transparent',
    color: right ? 'var(--bg)' : wrong ? 'var(--onacc)' : 'var(--ink)',
    cursor: revealed.value ? 'default' : 'pointer',
  }
}
const mark = (i) => (revealed.value && i === q.value.answer ? '✓' : revealed.value && sel.value === i ? '✕' : '')

function choose(i) {
  if (!revealed.value) sel.value = i
}
function validate() {
  if (sel.value === null || revealed.value) return
  const ok = sel.value === q.value.answer
  revealed.value = true
  if (ok) score.value++
  hist.value.push(ok)
}
function next() {
  if (idx.value + 1 >= questions.value.length) {
    finished.value = true
    if (!isRandom) {
      result.value = recordQuizResult(state, themeId, score.value, questions.value.length)
      pushQuietly()
    }
    window.scrollTo(0, 0)
    return
  }
  idx.value++
  sel.value = null
  revealed.value = false
}

const ok = computed(() => sel.value === q.value.answer)
const fb = computed(() =>
  ok.value ? ['Correct !', 'var(--ink)'] : sel.value === 'idk' ? ["Aucun souci — mieux vaut l'apprendre ici qu'en entretien.", 'var(--acc)'] : ['Raté.', 'var(--acc)']
)

const pct = computed(() => Math.round((score.value / total.value) * 100))
const verdict = computed(() =>
  pct.value >= 80
    ? ["Excellent ! Le thème s'espace dans ta courbe de révision.", 'var(--ink)', 'var(--bg)']
    : pct.value >= 60
      ? ['Pas mal, mais le thème reste au même palier — à retravailler.', 'var(--sf)', 'var(--ink)']
      : ['Le thème repart au début de la courbe : révision dès demain.', 'var(--acc)', 'var(--onacc)']
)
const nextReview = computed(() =>
  result.value
    ? `Prochaine révision : ${dateShort(result.value.nextReview)} (palier ${result.value.level + 1}/${INTERVALS_DAYS.length})`
    : 'Quiz aléatoire : ta courbe de révision ne change pas.'
)

function onKey(e) {
  if (finished.value || /INPUT|TEXTAREA/.test(e.target.tagName)) return
  const n = parseInt(e.key, 10)
  if (n >= 1 && n <= q.value.choices.length) choose(n - 1)
  else if (e.key === 'Enter') {
    e.preventDefault()
    revealed.value ? next() : validate()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <section v-if="!questions.length" class="page-hero">
    <div>
      <router-link to="/quiz" class="back">← Tous les thèmes</router-link>
      <h1 class="s-title" style="margin-top: 16px">{{ title }}</h1>
    </div>
    <p class="muted">Pas encore de questions pour ce thème.</p>
  </section>

  <template v-else-if="!finished">
    <div class="progress"><div :style="{ width: `${((idx + (revealed ? 1 : 0)) / total) * 100}%` }"></div></div>
    <section class="s-head band">
      <div class="s-left"><router-link to="/quiz" class="back">← Tous les thèmes</router-link><h1 class="s-title">{{ title }}</h1></div>
      <span class="s-title">{{ idx + 1 }} / {{ total }}</span>
    </section>

    <section class="cells band">
      <div class="q-col">
        <div class="tags">
          <span class="lvl" :style="{ background: lvl[1], color: lvl[2] }">{{ lvl[0] }}</span>
          <span v-if="tagName" class="tag">{{ tagName }}</span>
        </div>
        <div class="q-h" role="heading" aria-level="2">
          <template v-for="(p, pi) in parts(q.q)" :key="pi">
            <pre v-if="p.code" class="code-block q-code">{{ p.t }}</pre>
            <p v-else class="q-text"><template v-for="(s, si) in p.segs" :key="si"><code v-if="s.kind === 'code'" class="q-inline">{{ s.t }}</code><strong v-else-if="s.kind === 'bold'" class="q-bold">{{ s.t }}</strong><span v-else>{{ s.t }}</span></template></p>
          </template>
        </div>
        <div class="choices">
          <button v-for="(c, i) in q.choices" :key="i" class="choice" :style="choiceStyle(i)" @click="choose(i)">
            <span class="key">{{ i + 1 }}</span><span>{{ c }}</span><span class="mark">{{ mark(i) }}</span>
          </button>
          <button
            class="idk"
            :style="{ borderColor: sel === 'idk' ? 'var(--ink)' : 'var(--rule)', background: sel === 'idk' ? 'var(--sf)' : 'transparent', color: sel === 'idk' ? 'var(--ink)' : 'var(--mut)' }"
            @click="choose('idk')"
          >Je ne sais pas — montre-moi la réponse et explique</button>
        </div>
        <div class="actions">
          <button v-if="!revealed" class="go ink" :disabled="sel === null" @click="validate">Valider</button>
          <button v-else class="go acc" @click="next">{{ idx + 1 >= total ? 'Voir le résultat' : 'Question suivante →' }}</button>
          <span class="hint">Touches 1–{{ q.choices.length }} pour choisir · Entrée pour valider</span>
        </div>
      </div>

      <aside class="a-col">
        <template v-if="!revealed">
          <div class="kicker">Score en cours</div>
          <div class="score">{{ score }}<span>/{{ total }}</span></div>
          <div class="dots"><span v-for="(_, i) in questions" :key="i" :style="{ background: i < hist.length ? (hist[i] ? 'var(--ink)' : 'var(--acc)') : 'var(--hair)' }"></span></div>
        </template>
        <template v-else>
          <div class="fb" :style="{ color: fb[1] }">{{ fb[0] }}</div>
          <p v-if="!ok" class="a-p"><strong>La bonne réponse :</strong> {{ q.choices[q.answer] }}</p>
          <template v-for="(p, pi) in parts(q.explain)" :key="pi">
            <pre v-if="p.code" class="code-block">{{ p.t }}</pre>
            <p v-else class="a-p ex"><template v-for="(s, si) in p.segs" :key="si"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><strong v-else-if="s.kind === 'bold'">{{ s.t }}</strong><span v-else>{{ s.t }}</span></template></p>
          </template>
          <div v-if="q.why" class="why"><span class="why-k">Pourquoi c'est important</span><span class="why-t">{{ q.why }}</span></div>
          <a v-if="q.doc" :href="q.doc" target="_blank" rel="noopener" class="doc">Approfondir dans la documentation<Icon name="arrow-up-right" /></a>
        </template>
      </aside>
    </section>
  </template>

  <section v-else class="cells band">
    <div class="r-left">
      <div class="kicker">{{ title }} — Résultat</div>
      <div class="r-score">{{ score }}<span>/{{ total }}</span></div>
    </div>
    <div class="r-right" :style="{ background: verdict[1], color: verdict[2] }">
      <div class="r-pct">{{ pct }} %</div>
      <p class="r-v">{{ verdict[0] }}</p>
      <p class="r-n">{{ nextReview }}</p>
      <div class="r-btns">
        <router-link to="/quiz" class="r-back">← Tous les thèmes</router-link>
        <button class="r-replay" :style="verdict[1] === 'var(--ink)' ? { background: 'var(--bg)', color: 'var(--ink)' } : null" @click="router.go(0)">Rejouer</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.progress { height: 6px; background: var(--hair); position: relative; }
.progress > div { position: absolute; left: 0; top: 0; bottom: 0; background: var(--acc); transition: width 0.4s; }
.s-head { display: flex; flex-wrap: wrap; gap: 12px 24px; justify-content: space-between; align-items: baseline; padding: 28px var(--pad); }
.s-left { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
.back { color: var(--mut); font-size: 14px; font-weight: 600; }
.s-title { font-size: clamp(32px, 4vw, 48px); letter-spacing: -0.035em; font-weight: 800; }

.q-col { flex: 3 1 560px; min-width: 0; padding: 36px clamp(20px, 3vw, 48px) 44px; display: flex; flex-direction: column; gap: 22px; }
.tags { display: flex; gap: 8px; flex-wrap: wrap; }
.lvl { font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 9px; }
.tags .tag { font-weight: 600; padding: 4px 9px; }
.q-h { display: flex; flex-direction: column; gap: 14px; max-width: 900px; }
.q-text { font-size: clamp(26px, 3vw, 38px); line-height: 1.15; letter-spacing: -0.025em; font-weight: 700; text-wrap: pretty; }
.q-inline { font: 600 0.82em var(--mono); background: var(--sf); border: 1px solid var(--hair); padding: 1px 6px; }
.q-bold { font-weight: 800; color: var(--acc); }
.q-code { font-size: 14px; }
.choices { display: flex; flex-direction: column; gap: 8px; }
.choice { display: grid; grid-template-columns: 40px minmax(0, 1fr) 24px; gap: 14px; align-items: center; padding: 16px 18px; border: 2px solid; font-size: 16px; line-height: 1.4; text-align: left; transition: background 0.2s, border-color 0.2s; }
.choice:hover { border-color: var(--ink) !important; }
.key { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 2px solid currentColor; font-size: 14px; font-weight: 800; }
.mark { font-size: 18px; font-weight: 800; }
.idk { padding: 14px 18px; border: 2px dashed; font-size: 15px; text-align: left; }
.actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.go { height: 52px; padding: 0 22px; border: 0; font-size: 15px; font-weight: 800; }
.go.ink { background: var(--ink); color: var(--bg); }
.go.ink:disabled { opacity: 0.35; }
.go.acc { background: var(--acc); color: var(--onacc); }
.hint { font-size: 12px; color: var(--mut); }

.a-col { flex: 2 1 360px; padding: 36px var(--pad); display: flex; flex-direction: column; gap: 18px; }
.score { font-size: 96px; font-weight: 800; letter-spacing: -0.06em; line-height: 0.9; }
.score span { color: var(--mut); font-size: 48px; }
.dots { display: flex; gap: 4px; flex-wrap: wrap; }
.dots span { width: 28px; height: 8px; }
.fb { font-size: clamp(28px, 3vw, 40px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; }
.a-p { font-size: 16px; line-height: 1.5; }
.a-p.ex { line-height: 1.6; }
.why { border-top: 2px solid var(--rule); padding-top: 14px; display: flex; flex-direction: column; gap: 6px; }
.why-k { font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--acc); }
.why-t { font-size: 15px; line-height: 1.5; }
.doc { font-size: 14px; font-weight: 700; display: flex; gap: 8px; align-items: center; }

.r-left { flex: 3 1 520px; padding: 48px clamp(20px, 3vw, 48px); }
.r-score { font-size: clamp(120px, 18vw, 240px); font-weight: 800; letter-spacing: -0.07em; line-height: 0.85; margin-top: 20px; }
.r-score span { color: var(--mut); }
.r-right { flex: 2 1 360px; padding: 48px var(--pad); display: flex; flex-direction: column; gap: 18px; justify-content: flex-end; }
.r-pct { font-size: 72px; font-weight: 800; letter-spacing: -0.05em; line-height: 0.9; }
.r-v { font-size: 22px; line-height: 1.3; font-weight: 600; }
.r-n { font-size: 14px; opacity: 0.85; }
.r-btns { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.r-back { height: 48px; padding: 0 18px; display: flex; align-items: center; background: transparent; color: inherit; border: 2px solid currentColor; font-size: 14px; font-weight: 700; }
.r-back:hover { color: inherit; opacity: 0.8; }
.r-replay { height: 48px; padding: 0 18px; background: var(--ink); color: var(--bg); border: 0; font-size: 14px; font-weight: 800; }
</style>
