<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '../components/Icon.vue'
import { state } from '../stores/progress.js'
import { caseById, checkAnswer } from '../data/sqlCases/index.js'
import { conceptsFor } from '../data/sqlConcepts.js'
import { createDatabase, runQuery, describeSchema } from '../lib/sqlEngine.js'
import { pushQuietly } from '../lib/github.js'
import { segs } from '../lib/format.js'

const route = useRoute()
const affaire = caseById(route.params.id)

// Progression persistée (+ migration des sauvegardes sans champ notes)
if (affaire) {
  if (!state.sqlCases[affaire.id]) state.sqlCases[affaire.id] = { solvedSteps: [], solved: false, hintsUsed: 0, notes: '' }
  else if (state.sqlCases[affaire.id].notes === undefined) state.sqlCases[affaire.id].notes = ''
}
const progress = computed(() => state.sqlCases[affaire.id])
const step = computed(() => progress.value.solvedSteps.length)
const cur = computed(() => affaire.steps[step.value] || {})

const db = ref(null)
const dbError = ref('')
const schema = ref([])
const sql = ref('')
const result = ref(null)
const showSchema = ref(true)
const answer = ref('')
const fb = ref('')
const shown = ref(0)

onMounted(async () => {
  if (!affaire) return
  try {
    db.value = await createDatabase(affaire.setupSql)
    schema.value = describeSchema(db.value)
  } catch (e) {
    dbError.value = e.message
  }
})
onUnmounted(() => db.value?.close())

function execute() {
  if (db.value && sql.value.trim()) result.value = runQuery(db.value, sql.value)
}
function onSqlKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    execute()
  }
}
function showHint() {
  if (shown.value < 3) {
    shown.value++
    progress.value.hintsUsed++
  }
}
function submit() {
  fb.value = checkAnswer(cur.value, answer.value) ? 'ok' : 'ko'
}
function nextStep() {
  progress.value.solvedSteps.push(step.value)
  if (progress.value.solvedSteps.length >= affaire.steps.length) {
    progress.value.solved = true
    pushQuietly()
  }
  answer.value = ''
  fb.value = ''
  shown.value = 0
}
function restart() {
  const notes = progress.value.notes
  state.sqlCases[affaire.id] = { solvedSteps: [], solved: false, hintsUsed: 0, notes }
  answer.value = ''
  fb.value = ''
  shown.value = 0
}

const story = computed(() => (affaire?.story || '').split('\n\n').map(segs))
const doneSteps = computed(() => affaire.steps.slice(0, progress.value.solved ? affaire.steps.length : step.value))
const barColor = (i) => (progress.value.solved || i < step.value ? 'var(--acc)' : i === step.value ? 'var(--ink)' : 'var(--hair)')
const hintVerdict = computed(() => {
  const h = progress.value.hintsUsed
  return h === 0 ? 'sans-faute magistral !' : h <= 3 ? 'très propre.' : "l'important c'est d'apprendre."
})
const plain = (t) => String(t || '').replace(/\*\*/g, '')
</script>

<template>
  <section v-if="!affaire" class="page-hero">
    <div><router-link to="/sql" class="back">← Toutes les enquêtes</router-link><h1 class="c-title" style="margin-top: 20px">Enquête introuvable<span class="dot">.</span></h1></div>
    <span></span>
  </section>

  <template v-else>
    <section class="c-head band">
      <router-link to="/sql" class="back">← Toutes les enquêtes</router-link>
      <div class="c-row">
        <h1 class="c-title">{{ affaire.title }}<span class="dot">.</span></h1>
        <div class="c-side">
          <div class="c-tags"><span class="lvl">{{ affaire.level }}</span><span class="muted" style="font-size: 13px">{{ affaire.skills }}</span></div>
          <div class="bars"><span v-for="(_, i) in affaire.steps" :key="i" :style="{ background: barColor(i) }"></span></div>
          <span class="muted" style="font-size: 12px">
            {{ progress.solved ? 'Enquête résolue' : `Étape ${step + 1} / ${affaire.steps.length}` }} · {{ progress.hintsUsed }} indice(s) utilisé(s)
          </span>
        </div>
      </div>
    </section>

    <section class="cells band">
      <div class="story">
        <p v-for="(p, pi) in story" :key="pi" class="story-p"><template v-for="(s, si) in p" :key="si"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><strong v-else-if="s.kind === 'bold'" style="font-weight: 800">{{ s.t }}</strong><span v-else>{{ s.t }}</span></template></p>
      </div>
      <div class="notes">
        <div class="kicker" style="color: var(--ink)">Carnet d'enquête</div>
        <textarea
          v-model="progress.notes"
          spellcheck="false"
          aria-label="Carnet d'enquête"
          placeholder="Tes hypothèses, suspects, résultats intermédiaires… Sauvegardé automatiquement, il survit à la fermeture du navigateur."
        ></textarea>
      </div>
    </section>

    <section class="cells band">
      <div class="console">
        <div class="con-head">
          <h2 class="sub-h">Console SQL</h2>
          <span class="db" :style="{ color: dbError ? 'var(--acc)' : 'var(--mut)' }">{{ dbError ? `Erreur : ${dbError}` : db ? 'Base SQLite chargée' : 'Chargement de la base…' }}</span>
        </div>
        <p class="muted" style="font-size: 13px">Tu peux enchaîner plusieurs requêtes séparées par <code class="mono">;</code> — chaque SELECT affiche son propre tableau.</p>
        <textarea v-model="sql" class="sql" spellcheck="false" aria-label="Requête SQL" placeholder="SELECT * FROM …;" @keydown="onSqlKey"></textarea>
        <div class="con-btns">
          <button class="exec" :disabled="!db" @click="execute"><Icon name="play" :size="12" />Exécuter (Ctrl+Entrée)</button>
          <button class="btn-outline" style="height: 44px; padding: 0 16px" @click="showSchema = !showSchema">{{ showSchema ? 'Masquer le schéma' : 'Afficher le schéma' }}</button>
        </div>
        <template v-if="result">
          <div v-if="result.error" class="err">{{ result.error }}</div>
          <p v-else-if="result.empty" class="muted" style="font-size: 13px">Requête exécutée — aucun résultat à afficher.</p>
          <div v-for="(set, si) in result.sets || []" :key="si" class="set">
            <span v-if="result.sets.length > 1" class="muted" style="font-size: 12px">Résultat {{ si + 1 }} / {{ result.sets.length }}</span>
            <div class="table-wrap">
              <table>
                <thead><tr><th v-for="c in set.columns" :key="c">{{ c }}</th></tr></thead>
                <tbody>
                  <tr v-for="(row, ri) in set.rows" :key="ri"><td v-for="(cell, ci) in row" :key="ci">{{ cell === null ? 'NULL' : cell }}</td></tr>
                </tbody>
              </table>
            </div>
            <span class="muted" style="font-size: 12px">{{ set.rows.length }} ligne(s)</span>
          </div>
        </template>
      </div>
      <aside v-if="showSchema" class="schema">
        <div class="kicker" style="color: var(--ink); margin-bottom: 10px">Schéma</div>
        <button v-for="t in schema" :key="t.name" class="tbl" :title="`Afficher les 20 premières lignes de ${t.name}`" @click="sql = `SELECT * FROM ${t.name} LIMIT 20;`">
          <span class="tbl-head"><span>{{ t.name }}</span><span class="tbl-c">{{ t.count }} lignes</span></span>
          <span class="tbl-cols">{{ t.columns.map((c) => `${c.name} ${c.type}`).join(' · ') }}</span>
        </button>
      </aside>
    </section>

    <section class="inquiry">
      <h2 class="sub-h" style="margin-bottom: 18px">L'enquête</h2>
      <details v-for="(d, i) in doneSteps" :key="i" class="done">
        <summary><span class="done-k">✓ Étape {{ i + 1 }}</span><span class="done-q">{{ plain(d.question) }}</span></summary>
        <p class="done-ex"><template v-for="(s, si) in segs(d.explain)" :key="si"><code v-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><strong v-else-if="s.kind === 'bold'">{{ s.t }}</strong><span v-else>{{ s.t }}</span></template></p>
        <pre class="code-block">{{ d.solutionQuery }}</pre>
      </details>

      <div v-if="!progress.solved" class="current">
        <span class="cur-l">{{ cur.final ? 'Question finale' : `Étape ${step + 1} / ${affaire.steps.length}` }}</span>
        <p class="cur-q"><template v-for="(s, si) in segs(cur.question)" :key="si"><strong v-if="s.kind === 'bold'" style="color: var(--acc)">{{ s.t }}</strong><code v-else-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><span v-else>{{ s.t }}</span></template></p>

        <details v-if="conceptsFor(cur).length" class="toolbox">
          <summary>Boîte à outils SQL de cette étape — {{ conceptsFor(cur).length }} concept(s)</summary>
          <div v-for="c in conceptsFor(cur)" :key="c.name" class="concept">
            <span class="concept-n">{{ c.name }}</span>
            <pre class="code-block">{{ c.syntax }}</pre>
            <p>{{ c.desc }}</p>
            <a :href="c.doc" target="_blank" rel="noopener" class="concept-doc">Documentation<Icon name="arrow-up-right" :size="12" /></a>
          </div>
        </details>

        <div v-for="h in shown" :key="h" class="hint"><strong>Indice {{ h }}/3 :</strong> {{ cur.hints[h - 1] }}</div>

        <div class="answer-row">
          <input v-model="answer" class="answer" :placeholder="cur.placeholder" :disabled="fb === 'ok'" aria-label="Ta réponse" @input="fb === 'ko' && (fb = '')" @keydown.enter="submit" />
          <button class="verify" :disabled="fb === 'ok'" @click="submit">Vérifier</button>
          <button v-if="shown < 3 && fb !== 'ok'" class="hint-btn" @click="showHint">Indice ({{ shown }}/3)</button>
        </div>
        <p v-if="fb === 'ko'" class="ko">Ce n'est pas ça — continue de creuser (ou prends un indice).</p>
        <div v-if="fb === 'ok'" class="ok">
          <p class="ok-ex"><template v-for="(s, si) in segs(cur.explain)" :key="si"><strong v-if="s.kind === 'bold'">{{ s.t }}</strong><code v-else-if="s.kind === 'code'" class="code-inline">{{ s.t }}</code><span v-else>{{ s.t }}</span></template></p>
          <span class="muted" style="font-size: 13px">Une requête qui résout cette étape :</span>
          <pre class="code-block">{{ cur.solutionQuery }}</pre>
          <button class="next" @click="nextStep">{{ step + 1 >= affaire.steps.length ? "Clore l'enquête" : 'Étape suivante →' }}</button>
        </div>
      </div>

      <div v-else class="closed">
        <span class="closed-h">Affaire classée.</span>
        <p class="closed-p">{{ affaire.conclusion }}</p>
        <p class="closed-h2">Indices utilisés : {{ progress.hintsUsed }} — {{ hintVerdict }}</p>
        <button class="replay" @click="restart">Rejouer l'enquête</button>
      </div>
    </section>
  </template>
</template>

<style scoped>
.back { color: var(--mut); font-size: 14px; font-weight: 600; }
.c-head { padding: 28px var(--pad) 36px; }
.c-row { display: flex; flex-wrap: wrap; gap: 24px 48px; align-items: flex-end; margin-top: 20px; }
.c-title { flex: 2 1 520px; font-size: clamp(48px, 6.5vw, 96px); line-height: 0.92; letter-spacing: -0.05em; font-weight: 800; text-wrap: balance; }
.c-side { flex: 1 1 300px; display: flex; flex-direction: column; gap: 10px; }
.c-tags { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.lvl { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 8px; background: var(--ink); color: var(--bg); }
.bars { display: flex; gap: 4px; }
.bars span { flex: 1; height: 8px; }

.story { flex: 3 1 520px; padding: 36px clamp(20px, 3vw, 48px); display: flex; flex-direction: column; gap: 16px; }
.story-p { font-size: 19px; line-height: 1.6; max-width: 760px; text-wrap: pretty; }
.notes { flex: 2 1 340px; padding: 36px var(--pad); display: flex; flex-direction: column; gap: 12px; }
.notes textarea { flex: 1; min-height: 200px; resize: vertical; padding: 14px; border: 2px solid var(--rule); background: var(--sf); color: var(--ink); font-size: 15px; line-height: 1.55; outline: none; }
.notes textarea:focus { border-color: var(--ink); }

.console { flex: 3 1 560px; min-width: 0; padding: 32px clamp(20px, 3vw, 48px); display: flex; flex-direction: column; gap: 14px; }
.con-head { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; }
.sub-h { font-size: clamp(32px, 3.6vw, 44px); letter-spacing: -0.035em; font-weight: 800; }
.db { font-size: 12px; font-weight: 600; }
.sql { min-height: 150px; resize: vertical; padding: 16px; border: 0; background: var(--code-bg); color: var(--code-ink); font: 500 15px/1.55 var(--mono); outline: none; caret-color: #ff563c; }
.sql:focus-visible { outline: 2px solid var(--acc); outline-offset: 2px; }
.con-btns { display: flex; gap: 10px; flex-wrap: wrap; }
.exec { height: 44px; padding: 0 18px; background: var(--acc); color: var(--onacc); border: 0; font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
.err { padding: 12px 14px; background: var(--acc); color: var(--onacc); font: 500 14px var(--mono); }
.set { display: flex; flex-direction: column; gap: 6px; }
.table-wrap { overflow: auto; max-height: 360px; border: 2px solid var(--rule); }
table { border-collapse: collapse; width: 100%; font: 500 13px var(--mono); }
th { position: sticky; top: 0; background: var(--ink); color: var(--bg); text-align: left; padding: 8px 12px; font-weight: 700; white-space: nowrap; }
td { padding: 7px 12px; border-bottom: 1px solid var(--hair); white-space: nowrap; }
.schema { flex: 1 1 280px; padding: 32px clamp(20px, 2.4vw, 32px); display: flex; flex-direction: column; gap: 4px; }
.tbl { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border: 0; border-top: 1px solid var(--hair); background: transparent; color: var(--ink); text-align: left; }
.tbl:hover { color: var(--acc); }
.tbl-head { display: flex; justify-content: space-between; width: 100%; font: 700 14px var(--mono); }
.tbl-c { font: 500 12px var(--font); color: var(--mut); }
.tbl-cols { font: 500 12px/1.5 var(--mono); color: var(--mut); }

.inquiry { padding: 36px clamp(20px, 3vw, 48px) 56px; display: flex; flex-direction: column; gap: 2px; }
.done { border-top: 2px solid var(--rule); padding: 16px 0; opacity: 0.8; }
.done summary { cursor: pointer; font-size: 16px; font-weight: 700; display: flex; gap: 12px; align-items: baseline; }
.done-k { color: var(--acc); white-space: nowrap; }
.done-q { font-weight: 500; }
.done-ex { margin: 12px 0; font-size: 15px; line-height: 1.55; max-width: 820px; }
.current { border: 2px solid var(--ink); padding: 28px clamp(20px, 2.4vw, 32px); display: flex; flex-direction: column; gap: 16px; margin-top: 12px; }
.cur-l { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--acc); }
.cur-q { font-size: clamp(22px, 2.4vw, 30px); line-height: 1.25; font-weight: 700; letter-spacing: -0.02em; max-width: 900px; }
.toolbox { border-top: 2px solid var(--rule); border-bottom: 2px solid var(--rule); padding: 12px 0; }
.toolbox summary { cursor: pointer; font-size: 14px; font-weight: 700; }
.concept { display: flex; flex-direction: column; gap: 6px; padding: 14px 0; border-top: 1px solid var(--hair); font-size: 14px; line-height: 1.5; }
.concept:first-of-type { border-top: 0; }
.concept-n { font-weight: 800; }
.concept-doc { display: inline-flex; gap: 6px; align-items: center; font-weight: 700; font-size: 13px; }
.hint { padding: 12px 14px; background: var(--sf); border-left: 4px solid var(--acc); font-size: 15px; line-height: 1.5; }
.answer-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.answer { flex: 1 1 220px; max-width: 340px; height: 48px; padding: 0 14px; border: 2px solid var(--ink); background: transparent; color: var(--ink); font-size: 16px; outline: none; }
.verify { height: 48px; padding: 0 20px; background: var(--ink); color: var(--bg); border: 0; font-size: 14px; font-weight: 800; }
.hint-btn { height: 48px; padding: 0 16px; background: transparent; color: var(--ink); border: 2px dashed var(--rule); font-size: 13px; font-weight: 600; }
.ko { font-size: 14px; font-weight: 600; color: var(--acc); }
.ok { display: flex; flex-direction: column; gap: 12px; border-top: 2px solid var(--rule); padding-top: 16px; }
.ok-ex { font-size: 17px; line-height: 1.6; max-width: 820px; }
.next { align-self: flex-start; height: 48px; padding: 0 20px; background: var(--acc); color: var(--onacc); border: 0; font-size: 14px; font-weight: 800; }
.closed { background: var(--acc); color: var(--onacc); padding: 32px clamp(20px, 2.4vw, 36px); display: flex; flex-direction: column; gap: 14px; margin-top: 12px; }
.closed-h { font-size: clamp(32px, 4vw, 52px); font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
.closed-p { font-size: 17px; line-height: 1.55; max-width: 820px; }
.closed-h2 { font-size: 14px; font-weight: 600; }
.replay { align-self: flex-start; height: 46px; padding: 0 18px; background: var(--onacc); color: var(--acc); border: 0; font-size: 14px; font-weight: 800; }
</style>
