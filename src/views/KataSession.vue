<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '../components/Icon.vue'
import PhpEditor from '../components/PhpEditor.vue'
import CodeBlock from '../components/CodeBlock.vue'
import { state } from '../stores/progress.js'
import { kataById } from '../data/katas/index.js'
import { php, bootPhp, runPhp, RUN_TIMEOUT_S } from '../lib/phpEngine.js'
import { KATA_FILE, runScript, testScript, parseReport } from '../lib/kataHarness.js'
import { recordKataResult, reviewStatus, masteryLabel, INTERVALS_DAYS } from '../lib/spaced.js'
import { pushQuietly } from '../lib/github.js'
import { segs, duration, dateShort } from '../lib/format.js'

const route = useRoute()
const kata = kataById(route.params.id)

// --- Essai en cours (persisté en local, jamais synchronisé) ---
const freshAttempt = () => ({ version: kata.version || 1, step: 0, code: kata.steps[0].starter, startedAt: null, hints: 0, shown: 0, revealed: false, finished: null })
// Kata modifié depuis l'essai en cours (nouveau code de départ ou nouveaux tests) : on repart de zéro
const outdated = ref(false)
if (kata) {
  const draft = state.kataDrafts[kata.id]
  if (draft && (draft.version || 1) !== (kata.version || 1)) outdated.value = true
  if (!draft || outdated.value) state.kataDrafts[kata.id] = freshAttempt()
}
const attempt = computed(() => kata && state.kataDrafts[kata.id])
const step = computed(() => kata.steps[attempt.value.step])
const isLast = computed(() => attempt.value.step === kata.steps.length - 1)
const sr = computed(() => kata && state.katas[kata.id])
const status = computed(() => reviewStatus(sr.value))

// Tests de l'étape courante + ceux des étapes précédentes (non-régression)
const tests = computed(() =>
  kata.steps.slice(0, attempt.value.step + 1).flatMap((s, si) => s.tests.map((t) => ({ ...t, step: si })))
)

// Le chrono démarre à la première frappe
watch(
  () => [attempt.value, attempt.value?.code],
  ([a], [prev]) => {
    if (a && a === prev && !a.startedAt && !a.finished) a.startedAt = Date.now() // même essai, code modifié
  }
)
const now = ref(Date.now())
let tick = null
onMounted(() => {
  tick = setInterval(() => (now.value = Date.now()), 1000)
  if (kata) bootPhp().catch(() => {})
})
onUnmounted(() => clearInterval(tick))
const elapsed = computed(() => (attempt.value.startedAt ? now.value - attempt.value.startedAt : 0))

// --- Exécution ---
const running = ref('') // '' | 'run' | 'validate'
const result = ref(null) // { mode, report, raw, timeout, error }
const stepPassed = ref(false)

// Messages PHP : chemins internes remplacés par des numéros de ligne, trace du harness retirée
const FILE_RE = KATA_FILE.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const tidy = (s) =>
  String(s || '')
    .replace(new RegExp(` in ${FILE_RE} on line (\\d+)`, 'g'), ' (ligne $1)')
    .replace(new RegExp(` in ${FILE_RE}:(\\d+)`, 'g'), ' (ligne $1)')
    .replace(new RegExp(`${FILE_RE}\\((\\d+)\\)`, 'g'), 'ligne $1')
    .replace(/^#\d+ php-wasm run script.*$\n?/gm, '')
    .replace(new RegExp(FILE_RE, 'g'), 'ton code')

async function exec(mode) {
  if (running.value || attempt.value.finished) return
  running.value = mode
  result.value = null
  try {
    const script = mode === 'run' ? runScript() : testScript(tests.value)
    const r = await runPhp(script, { [KATA_FILE]: attempt.value.code })
    if (r.timeout) {
      result.value = { mode, timeout: true }
      return
    }
    if (mode === 'run') {
      result.value = { mode, raw: tidy(r.output) }
      return
    }
    const { report, raw } = parseReport(r.output)
    result.value = { mode, report, raw: tidy(raw) }
    if (report?.loaded && report.results.length && report.results.every((x) => x.ok)) {
      stepPassed.value = true
      if (isLast.value) finish()
    }
  } catch (e) {
    result.value = { mode, error: e.message }
  } finally {
    running.value = ''
  }
}

const rows = computed(() => {
  const res = result.value?.mode === 'validate' && result.value.report?.loaded ? result.value.report.results : null
  return tests.value.map((t, i) => ({ ...t, res: res?.[i] }))
})
const passedCount = computed(() => rows.value.filter((r) => r.res?.ok).length)

function nextStep() {
  attempt.value.step++
  attempt.value.shown = 0
  stepPassed.value = false
  result.value = null
}

function finish() {
  const a = attempt.value
  const ms = a.startedAt ? Date.now() - a.startedAt : 0
  const t = recordKataResult(state, kata.id, a, ms)
  a.finished = { ms, level: t.level, nextReview: t.nextReview, hints: a.hints, revealed: a.revealed }
  pushQuietly()
}

function restart() {
  const dirty = attempt.value.code !== kata.steps[0].starter
  if (!attempt.value.finished && dirty && !confirm('Repartir du code de départ ? Ton code actuel sera perdu.')) return
  // Indices et solution déjà vus restent comptés tant que l'essai n'est pas terminé
  const { hints, revealed, finished } = attempt.value
  state.kataDrafts[kata.id] = { ...freshAttempt(), ...(finished ? {} : { hints, revealed }) }
  stepPassed.value = false
  result.value = null
}

function showHint() {
  const a = attempt.value
  if (a.shown < step.value.hints.length) {
    a.shown++
    a.hints++
  }
}

const solutionOpen = ref(false)
function revealSolution() {
  if (!stepPassed.value && !attempt.value.revealed) {
    if (!confirm('Voir la solution compte comme un échec : le kata reviendra demain. Continuer ?')) return
    attempt.value.revealed = true
  }
  solutionOpen.value = true
}
watch(() => attempt.value?.step, () => (solutionOpen.value = false))

const bars = computed(() =>
  kata.steps.map((_, i) =>
    attempt.value.finished || i < attempt.value.step || (i === attempt.value.step && stepPassed.value)
      ? 'var(--acc)'
      : i === attempt.value.step
        ? 'var(--ink)'
        : 'var(--hair)'
  )
)
const bestMs = computed(() => {
  const times = (sr.value?.history || []).filter((h) => !h.revealed && h.ms).map((h) => h.ms)
  return times.length ? Math.min(...times) : null
})
const verdict = computed(() => {
  const f = attempt.value.finished
  if (!f) return ''
  if (f.revealed) return 'Solution consultée : le kata revient demain pour ancrer le geste.'
  if (f.hints) return `Réussi avec ${f.hints} indice${f.hints > 1 ? 's' : ''} : même palier, on le refait au même intervalle.`
  return 'Sans aide : palier suivant, la prochaine répétition s’espace.'
})
const engineLabel = computed(() =>
  ({
    idle: 'Moteur PHP en attente',
    booting: 'Chargement de PHP 8.4 (≈ 3,5 Mo, mis en cache ensuite)…',
    ready: `PHP ${php.version} prêt`,
    error: php.error,
  })[php.status]
)
const theoryOpen = !sr.value // ouvert à la découverte, replié pour les répétitions
</script>

<template>
  <section v-if="!kata" class="page-hero">
    <div><router-link to="/katas" class="back">← Tous les katas</router-link><h1 class="k-title" style="margin-top: 20px">Kata introuvable<span class="dot">.</span></h1></div>
    <span></span>
  </section>

  <template v-else>
    <section class="k-head band">
      <router-link to="/katas" class="back">← Tous les katas</router-link>
      <div class="k-row">
        <h1 class="k-title">{{ kata.name }}<span class="dot">.</span></h1>
        <div class="k-side">
          <div class="k-tags">
            <span class="lvl">{{ kata.family }}</span>
            <span class="muted" style="font-size: 13px">{{ kata.nameFr }} · {{ status.label }}{{ sr ? ` · ${masteryLabel(sr.level)}` : '' }}{{ bestMs ? ` · record ${duration(bestMs)}` : '' }}</span>
          </div>
          <a :href="kata.guru" target="_blank" rel="noopener" class="guru">La fiche complète sur refactoring.guru<Icon name="arrow-up-right" :size="12" /></a>
        </div>
      </div>
    </section>

    <!-- Comprendre -->
    <details class="theory band" :open="theoryOpen">
      <summary><span class="sub-h">Comprendre</span><span class="muted sum-hint">Problème, analogie, explication technique, exemple</span></summary>
      <div class="cells">
        <div class="cell">
          <div class="kicker k-acc">Le problème</div>
          <p class="txt"><template v-for="(s, i) in segs(kata.problem)" :key="i"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><strong v-else-if="s.kind === 'bold'">{{ s.t }}</strong><span v-else>{{ s.t }}</span></template></p>
          <div class="kid">
            <div class="kicker" style="color: var(--ink)">Expliqué à un enfant</div>
            <p class="txt">{{ kata.kid }}</p>
          </div>
        </div>
        <div class="cell cell-wide">
          <div class="kicker k-acc">Ce que fait le pattern</div>
          <p class="txt"><template v-for="(s, i) in segs(kata.technical)" :key="i"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><strong v-else-if="s.kind === 'bold'">{{ s.t }}</strong><span v-else>{{ s.t }}</span></template></p>
          <p class="txt muted"><template v-for="(s, i) in segs(kata.example.intro)" :key="i"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><span v-else>{{ s.t }}</span></template></p>
          <CodeBlock :code="kata.example.code" />
        </div>
      </div>
      <div class="cells">
        <div class="cell cell-wide">
          <div class="kicker k-acc">Dans Symfony</div>
          <p class="txt"><template v-for="(s, i) in segs(kata.symfony.text)" :key="i"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><span v-else>{{ s.t }}</span></template></p>
          <CodeBlock :code="kata.symfony.code" />
        </div>
        <div class="cell">
          <div class="kicker k-acc">Quand l'éviter</div>
          <ul class="avoid">
            <li v-for="(a, ai) in kata.avoid" :key="ai"><template v-for="(s, i) in segs(a)" :key="i"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><span v-else>{{ s.t }}</span></template></li>
          </ul>
        </div>
      </div>
    </details>

    <!-- Le kata -->
    <section class="brief band">
      <div class="brief-top">
        <h2 class="sub-h">Le kata</h2>
        <div class="progress">
          <div class="bars"><span v-for="(c, i) in bars" :key="i" :style="{ background: c }"></span></div>
          <span class="muted" style="font-size: 12px">
            {{ attempt.finished ? 'Kata terminé' : `Étape ${attempt.step + 1} / ${kata.steps.length} · ${step.kind}` }}
            · {{ attempt.startedAt ? duration(attempt.finished ? attempt.finished.ms : elapsed) : 'chrono à la première frappe' }}
            · {{ attempt.hints }} indice(s){{ attempt.revealed ? ' · solution vue' : '' }}
          </span>
        </div>
      </div>
      <p v-if="outdated" class="notice">Ce kata a été mis à jour depuis ton dernier essai : tu repars du nouveau code de départ.</p>
      <template v-if="!attempt.finished">
        <span class="cur-l">{{ step.title }}</span>
        <p class="cur-q"><template v-for="(s, i) in segs(step.brief)" :key="i"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><strong v-else-if="s.kind === 'bold'" style="color: var(--acc)">{{ s.t }}</strong><span v-else>{{ s.t }}</span></template></p>
        <div class="contract">
          <div class="kicker" style="color: var(--ink)">Contrat attendu par les tests</div>
          <ul>
            <li v-for="(c, ci) in step.contract" :key="ci"><template v-for="(s, i) in segs(c)" :key="i"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><span v-else>{{ s.t }}</span></template></li>
          </ul>
        </div>
      </template>
    </section>

    <section v-if="!attempt.finished" class="cells band">
      <div class="ide">
        <div class="ide-head">
          <span class="file mono">kata.php</span>
          <span class="engine" :style="{ color: php.status === 'error' ? 'var(--acc)' : 'var(--mut)' }">{{ engineLabel }}</span>
        </div>
        <PhpEditor v-model="attempt.code" @run="exec('run')" @validate="exec('validate')" />
        <div class="ide-btns">
          <button class="exec" :disabled="!!running" @click="exec('validate')"><Icon name="check" :size="14" />{{ running === 'validate' ? 'Tests en cours…' : 'Valider (Ctrl+Entrée)' }}</button>
          <button class="btn-outline" style="height: 44px; padding: 0 16px" :disabled="!!running" @click="exec('run')"><Icon name="play" :size="11" />{{ running === 'run' ? 'Exécution…' : 'Exécuter (Ctrl+Maj+Entrée)' }}</button>
          <button class="ghost" @click="restart">Recommencer</button>
        </div>
      </div>

      <aside class="panel">
        <div class="panel-head">
          <span class="kicker" style="color: var(--ink)">Tests</span>
          <span class="muted" style="font-size: 12px">{{ result?.mode === 'validate' && result.report?.loaded ? `${passedCount} / ${rows.length} réussis` : `${rows.length} tests` }}</span>
        </div>

        <div v-if="result?.timeout" class="err">Ton code n'a pas rendu la main en {{ RUN_TIMEOUT_S }} s (boucle infinie ?). Le moteur PHP a été relancé.</div>
        <div v-else-if="result?.error" class="err">{{ result.error }}</div>
        <div v-else-if="result?.mode === 'validate' && !result.report" class="err"><strong>Erreur fatale</strong> — les tests n'ont pas pu tourner.<pre>{{ result.raw }}</pre></div>
        <div v-else-if="result?.mode === 'validate' && !result.report.loaded" class="err"><strong>Ton code ne se charge pas</strong><pre>{{ result.report.loadError }}</pre></div>

        <ul class="tests">
          <li v-for="(r, i) in rows" :key="i" :class="{ ok: r.res?.ok, ko: r.res && !r.res.ok }">
            <span class="mark">{{ r.res ? (r.res.ok ? '✓' : '✗') : '○' }}</span>
            <span class="t-body">
              <span class="t-label"><span v-if="attempt.step > 0" class="t-step">É{{ r.step + 1 }}</span>{{ r.label }}</span>
              <span v-if="r.res && !r.res.ok" class="t-msg">{{ r.res.msg }}</span>
            </span>
          </li>
        </ul>
        <details class="test-code">
          <summary>Voir le code des tests</summary>
          <div v-for="(t, i) in tests" :key="i"><span class="muted" style="font-size: 12px">{{ t.label }}</span><CodeBlock :code="t.code" /></div>
        </details>

        <template v-if="result && (result.mode === 'run' || result.report?.stdout || (result.report && result.raw))">
          <span class="kicker" style="color: var(--ink); margin-top: 8px">Sortie</span>
          <pre class="out">{{ (result.mode === 'run' ? result.raw : [result.raw, result.report?.stdout].filter(Boolean).join('\n')) || '(rien d’affiché)' }}</pre>
        </template>
      </aside>
    </section>

    <!-- Aide, validation, fin -->
    <section class="after">
      <template v-if="!attempt.finished">
        <div v-for="h in attempt.shown" :key="h" class="hint"><strong>Indice {{ h }}/{{ step.hints.length }} :</strong> <template v-for="(s, i) in segs(step.hints[h - 1])" :key="i"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><span v-else>{{ s.t }}</span></template></div>
        <div v-if="!stepPassed" class="help-row">
          <button v-if="attempt.shown < step.hints.length" class="hint-btn" @click="showHint">Indice ({{ attempt.shown }}/{{ step.hints.length }})</button>
          <button class="hint-btn" @click="revealSolution">Voir la solution</button>
        </div>

        <div v-if="stepPassed && !isLast" class="ok">
          <span class="ok-h">Étape validée.</span>
          <p class="ok-p"><template v-for="(s, i) in segs(step.solutionNote)" :key="i"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><span v-else>{{ s.t }}</span></template></p>
          <details class="sol"><summary>Comparer avec une solution</summary><CodeBlock :code="step.solution" /></details>
          <button class="next" @click="nextStep">Étape suivante →</button>
        </div>

        <details v-if="solutionOpen && !stepPassed" class="sol sol-alone" open>
          <summary>Une solution possible</summary>
          <p class="ok-p"><template v-for="(s, i) in segs(step.solutionNote)" :key="i"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><span v-else>{{ s.t }}</span></template></p>
          <CodeBlock :code="step.solution" />
        </details>
      </template>

      <div v-else class="closed">
        <span class="closed-h">Kata terminé en {{ duration(attempt.finished.ms) }}.</span>
        <p class="closed-p">{{ verdict }}</p>
        <p class="closed-p">
          Palier {{ attempt.finished.level + 1 }} / {{ INTERVALS_DAYS.length }} ({{ masteryLabel(attempt.finished.level) }}) · prochaine répétition le
          <strong>{{ dateShort(attempt.finished.nextReview) }}</strong>, dans {{ INTERVALS_DAYS[attempt.finished.level] }} j.
        </p>
        <details class="sol sol-closed">
          <summary>Comparer avec la solution de la dernière étape</summary>
          <p class="ok-p"><template v-for="(s, i) in segs(step.solutionNote)" :key="i"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><span v-else>{{ s.t }}</span></template></p>
          <CodeBlock :code="step.solution" />
        </details>
        <button class="replay" @click="restart">Refaire le kata</button>
      </div>
    </section>
  </template>
</template>

<style scoped>
.back { color: var(--mut); font-size: 14px; font-weight: 600; }
.k-head { padding: 28px var(--pad) 36px; }
.k-row { display: flex; flex-wrap: wrap; gap: 24px 48px; align-items: flex-end; margin-top: 20px; }
.k-title { flex: 2 1 520px; font-size: clamp(56px, 8vw, 112px); line-height: 0.92; letter-spacing: -0.05em; font-weight: 800; }
.k-side { flex: 1 1 300px; display: flex; flex-direction: column; gap: 12px; }
.k-tags { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.lvl { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 8px; background: var(--ink); color: var(--bg); }
.guru { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; font-weight: 700; }
.sub-h { font-size: clamp(32px, 3.6vw, 44px); letter-spacing: -0.035em; font-weight: 800; }
.k-acc { color: var(--acc); }

.theory > summary { list-style: none; cursor: pointer; display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: baseline; padding: 28px var(--pad); border-bottom: 2px solid var(--rule); }
.theory > summary::-webkit-details-marker { display: none; }
.theory > summary::after { content: '+'; margin-left: auto; font-size: 28px; font-weight: 800; }
.theory[open] > summary::after { content: '−'; }
.sum-hint { font-size: 14px; }
.theory .cells + .cells { border-top: 2px solid var(--rule); }
.cell { flex: 2 1 340px; min-width: 0; padding: 32px clamp(20px, 3vw, 44px); display: flex; flex-direction: column; gap: 14px; }
.cell-wide { flex: 3 1 480px; }
.txt { font-size: 16px; line-height: 1.6; max-width: 760px; text-wrap: pretty; }
.kid { background: var(--sf); padding: 18px 20px; display: flex; flex-direction: column; gap: 8px; border-left: 4px solid var(--acc); }
.avoid { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 10px; font-size: 15px; line-height: 1.55; }

.brief { padding: 32px clamp(20px, 3vw, 48px); display: flex; flex-direction: column; gap: 16px; }
.brief-top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 12px 32px; }
.progress { display: flex; flex-direction: column; gap: 8px; flex: 0 1 380px; }
.bars { display: flex; gap: 4px; }
.bars span { flex: 1; height: 8px; }
.cur-l { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--acc); }
.cur-q { font-size: clamp(19px, 1.9vw, 24px); line-height: 1.4; font-weight: 600; letter-spacing: -0.01em; max-width: 980px; text-wrap: pretty; }
.notice { padding: 10px 14px; background: var(--sf); border-left: 4px solid var(--ink); font-size: 14px; }
.contract { border-top: 2px solid var(--rule); padding-top: 14px; display: flex; flex-direction: column; gap: 8px; }
.contract ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 15px; line-height: 1.5; }

.ide { flex: 3 1 560px; min-width: 0; padding: 24px clamp(16px, 2.4vw, 36px); display: flex; flex-direction: column; gap: 12px; }
.ide-head { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; }
.file { font-size: 13px; font-weight: 700; }
.engine { font-size: 12px; font-weight: 600; }
.ide-btns { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.exec { height: 44px; padding: 0 18px; background: var(--acc); color: var(--onacc); border: 0; font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
.exec:disabled, .btn-outline:disabled { opacity: 0.6; cursor: progress; }
.ide-btns .btn-outline { display: inline-flex; align-items: center; gap: 8px; }
.ghost { height: 44px; padding: 0 12px; background: transparent; border: 0; color: var(--mut); font-size: 13px; font-weight: 600; margin-left: auto; }
.ghost:hover { color: var(--acc); }

.panel { flex: 2 1 340px; min-width: 0; padding: 24px clamp(16px, 2.4vw, 32px); display: flex; flex-direction: column; gap: 10px; }
.panel-head { display: flex; justify-content: space-between; align-items: baseline; }
.err { padding: 12px 14px; background: var(--acc); color: var(--onacc); font-size: 14px; line-height: 1.45; }
.err pre { margin: 8px 0 0; font: 500 13px/1.5 var(--mono); white-space: pre-wrap; }
.tests { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.tests li { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; padding: 10px 0; border-top: 1px solid var(--hair); font-size: 14px; }
.mark { font-weight: 800; color: var(--mut); }
.tests li.ok .mark { color: var(--ink); }
.tests li.ko .mark { color: var(--acc); }
.t-body { display: flex; flex-direction: column; gap: 4px; }
.t-label { font-weight: 600; }
.tests li.ok .t-label { opacity: 0.7; }
.t-step { font-size: 10px; font-weight: 800; padding: 1px 4px; margin-right: 6px; border: 1px solid var(--rule); color: var(--mut); vertical-align: 2px; }
.t-msg { font: 500 12.5px/1.5 var(--mono); color: var(--acc); word-break: break-word; }
.test-code { border-top: 1px solid var(--hair); padding-top: 10px; font-size: 13px; }
.test-code summary { cursor: pointer; font-weight: 700; }
.test-code > div { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
.out { margin: 0; padding: 12px 14px; background: var(--code-bg); color: var(--code-ink); font: 500 13px/1.5 var(--mono); white-space: pre-wrap; max-height: 280px; overflow: auto; }

.after { padding: 28px clamp(20px, 3vw, 48px) 56px; display: flex; flex-direction: column; gap: 14px; }
.hint { padding: 12px 14px; background: var(--sf); border-left: 4px solid var(--acc); font-size: 15px; line-height: 1.5; }
.help-row { display: flex; gap: 10px; flex-wrap: wrap; }
.hint-btn { height: 44px; padding: 0 16px; background: transparent; color: var(--ink); border: 2px dashed var(--rule); font-size: 13px; font-weight: 600; }
.hint-btn:hover { border-color: var(--ink); }
.ok { border: 2px solid var(--ink); padding: 24px clamp(20px, 2.4vw, 32px); display: flex; flex-direction: column; gap: 14px; }
.ok-h { font-size: clamp(28px, 3vw, 40px); font-weight: 800; letter-spacing: -0.035em; line-height: 1; }
.ok-p { font-size: 16px; line-height: 1.6; max-width: 860px; }
.sol summary { cursor: pointer; font-size: 14px; font-weight: 700; }
.sol[open] summary { margin-bottom: 10px; }
.sol-alone { border: 2px dashed var(--rule); padding: 20px; display: flex; flex-direction: column; gap: 10px; }
.next { align-self: flex-start; height: 48px; padding: 0 20px; background: var(--acc); color: var(--onacc); border: 0; font-size: 14px; font-weight: 800; }
.closed { background: var(--acc); color: var(--onacc); padding: 32px clamp(20px, 2.4vw, 36px); display: flex; flex-direction: column; gap: 14px; }
.closed-h { font-size: clamp(32px, 4vw, 52px); font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
.closed-p { font-size: 17px; line-height: 1.55; max-width: 860px; }
.sol-closed { background: var(--bg); color: var(--ink); padding: 16px 18px; }
.replay { align-self: flex-start; height: 46px; padding: 0 18px; background: var(--onacc); color: var(--acc); border: 0; font-size: 14px; font-weight: 800; }
</style>
