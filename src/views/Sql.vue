<script setup>
import { computed } from 'vue'
import { state } from '../stores/progress.js'
import { SQL_CASES } from '../data/sqlCases/index.js'
import { pad2 } from '../lib/format.js'

const solved = computed(() => SQL_CASES.filter((c) => state.sqlCases[c.id]?.solved).length)

function prog(c) {
  const p = state.sqlCases[c.id]
  if (p?.solved) return 'Résolue'
  const n = p?.solvedSteps?.length || 0
  return n ? `${n}/${c.steps.length} étapes` : 'Non commencée'
}
</script>

<template>
  <section class="page-hero">
    <div>
      <div class="kicker">{{ SQL_CASES.length }} affaires · {{ solved }} résolue{{ solved > 1 ? 's' : '' }}</div>
      <h1 class="hero-title" style="margin-top: 18px">Enquêtes<br />SQL<span class="dot">.</span></h1>
    </div>
    <p class="intro pretty">
      Résous des affaires criminelles à coups de requêtes SQL. Base SQLite réelle dans ton navigateur : jointures, agrégations,
      fenêtres et CTE récursives au programme. Les indices sont là si tu bloques — mais chaque indice utilisé, c'est un peu de gloire en moins.
    </p>
  </section>

  <section>
    <router-link v-for="(c, i) in SQL_CASES" :key="c.id" :to="`/sql/${c.id}`" class="case">
      <span class="n">{{ pad2(i + 1) }}</span>
      <span class="mid"><span class="t">{{ c.title }}</span><span class="sk">{{ c.skills }}</span></span>
      <span class="end"><span class="lvl">{{ c.level }}</span><span class="pr">{{ prog(c) }}</span></span>
    </router-link>
  </section>
</template>

<style scoped>
.intro { font-size: 17px; line-height: 1.5; }
.case { width: 100%; display: grid; grid-template-columns: clamp(56px, 8vw, 120px) minmax(0, 1fr) auto; gap: 20px; align-items: center; padding: 28px var(--pad); border-bottom: 2px solid var(--rule); color: var(--ink); }
.case:hover { background: var(--acc); color: var(--onacc); }
.n { font-size: clamp(36px, 5vw, 64px); font-weight: 800; letter-spacing: -0.05em; opacity: 0.35; }
.mid { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.t { font-size: clamp(26px, 3.4vw, 44px); font-weight: 800; letter-spacing: -0.035em; line-height: 1.02; }
.sk { font-size: 14px; opacity: 0.75; }
.end { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.lvl { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 8px; border: 1px solid currentColor; white-space: nowrap; }
.pr { font-size: 12px; opacity: 0.75; white-space: nowrap; }
</style>
