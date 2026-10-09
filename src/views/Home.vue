<script setup>
import { computed, ref, onMounted } from 'vue'
import Icon from '../components/Icon.vue'
import { state } from '../stores/progress.js'
import { THEMES, themeById } from '../data/themes.js'
import { dueThemes } from '../lib/spaced.js'
import { SQL_CASES } from '../data/sqlCases/index.js'
import { loadData } from '../lib/data.js'
import { theme } from '../lib/theme.js'
import { isRead, toggleRead, markRead } from '../lib/read.js'
import { pad2, pct, deltaColor, money, dateShort, longDate, timeHM, sparkPoints } from '../lib/format.js'

const articles = ref(null)
const digest = ref(null)
const quotes = ref(null)

onMounted(async () => {
  const [a, d, q] = await Promise.all([loadData('articles'), loadData('digest'), loadData('quotes')])
  articles.value = a
  digest.value = d
  quotes.value = q
})

const stamp = computed(() => {
  const at = articles.value?.generatedAt
  return at ? `${longDate(at)} — mis à jour à ${timeHM(at)}` : longDate()
})

// Veille techno uniquement, du plus récent au plus ancien
const tech = computed(() =>
  (articles.value?.articles || [])
    .filter((x) => themeById(x.theme)?.group === 'tech')
    .sort((x, y) => new Date(y.date) - new Date(x.date))
)
const techFr = computed(() => tech.value.filter((a) => a.lang === 'fr').length)
const big = computed(() => tech.value[0])
const smalls = computed(() => tech.value.slice(1, 5))
const texts = computed(() => tech.value.slice(5, 9))
const thCol = (a) => (a.theme === 'securite' ? 'var(--acct)' : 'var(--mut)')

// Marchés
const assets = computed(() => (quotes.value?.assets || []).map((m) => ({ ...m, d1s: pct(m.changes?.d1), col: deltaColor(m.changes?.d1) })))

// L'actu : sujet le plus repris en tête, puis les trois suivants
const stories = computed(() =>
  (digest.value?.sections || [])
    .flatMap((s) => s.items.map((it) => ({ ...it, section: s.title })))
    .sort((a, b) => (b.coverage || 0) - (a.coverage || 0))
)
const lead = computed(() => stories.value[0])
const storiesRest = computed(() => stories.value.slice(1, 4))
const medias = (n) => `${n || 1} média${(n || 1) > 1 ? 's' : ''}`

// Révisions
const due = computed(() => dueThemes(state).map((id) => themeById(id)).filter(Boolean))
const neverTested = computed(() => THEMES.filter((t) => t.quiz && !state.themes[t.id]))
const sessions = computed(() => Object.values(state.themes).reduce((n, t) => n + (t.history?.length || 0), 0))
const reviseList = computed(() => [...due.value, ...neverTested.value])
const bigCount = computed(() => (due.value.length ? due.value.length : neverTested.value.length))
const bigLabel = computed(() =>
  due.value.length
    ? `thème${due.value.length > 1 ? 's' : ''} à réviser`
    : `thème${neverTested.value.length > 1 ? 's' : ''} jamais testé${neverTested.value.length > 1 ? 's' : ''}`
)

// Enquêtes SQL
const LVL_COL = { Intermédiaire: 'var(--mut)', Avancé: 'var(--ink)', Expert: 'var(--acc)' }
const solved = computed(() => SQL_CASES.filter((c) => state.sqlCases[c.id]?.solved).length)
</script>

<template>
  <section class="page-hero">
    <div>
      <div class="kicker">{{ stamp }}</div>
      <h1 class="hero-title" style="margin-top: 18px">Tableau<br />de bord<span class="dot">.</span></h1>
    </div>
    <div class="hero-side">
      <p class="lede pretty">Ton actu, tes marchés, ta veille, tes révisions et tes enquêtes SQL, au même endroit.</p>
      <div class="stats">
        <span>{{ tech.length }} articles</span><span>{{ techFr }} FR</span><span v-if="digest">{{ digest.articleCount }} dépêches</span>
      </div>
    </div>
  </section>

  <!-- Bandeau marchés -->
  <section v-if="assets.length" class="ticker band">
    <router-link v-for="m in assets" :key="m.id" to="/trading" class="tick">
      <span class="tk">{{ m.ticker }}</span>
      <span class="tv" :style="{ color: m.col }">{{ m.d1s }}</span>
    </router-link>
  </section>

  <!-- À la une -->
  <section class="cells band">
    <div class="globe">
      <dw-globe class="scene" :theme="theme"></dw-globe>
      <div class="globe-title">
        <span class="kicker" style="color: var(--acc)">À la une</span>
        <span class="globe-h">L'actu en {{ digest?.readingMinutes || 5 }} min</span>
      </div>
      <div class="globe-foot">
        <span>Les sujets des dernières 30 h, regroupés par événement</span><span>Survole pour orienter le globe</span>
      </div>
    </div>
    <div class="story">
      <template v-if="lead">
        <div class="kicker" style="color: var(--acct)">{{ lead.section }} — {{ medias(lead.coverage) }}</div>
        <h2 class="story-h pretty">{{ lead.title }}</h2>
        <p class="story-p pretty">{{ lead.body }}</p>
        <div class="story-tags">
          <a v-for="src in lead.sources" :key="src.link" :href="src.link" target="_blank" rel="noopener" class="tag">{{ src.source }}</a>
        </div>
        <div class="story-list">
          <router-link v-for="(s, i) in storiesRest" :key="s.title" to="/actu" class="story-row">
            <span class="story-n">{{ pad2(i + 2) }}</span>
            <span class="story-col"><span class="story-t">{{ s.title }}</span><span class="small muted">{{ medias(s.coverage) }}</span></span>
          </router-link>
        </div>
      </template>
      <p v-else class="story-p" style="flex: 1">Pas encore de résumé. Clique sur « Rafraîchir » pour le générer.</p>
      <router-link to="/actu" class="btn-acc" style="margin-top: 24px">Lire le résumé<Icon name="arrow-right" :size="18" /></router-link>
    </div>
  </section>

  <!-- Veille techno -->
  <section class="veille band">
    <div class="sec-head">
      <h2 class="sec-h">Veille techno</h2>
      <router-link to="/veille" class="sec-link">Toute la veille — {{ tech.length }} articles<Icon name="arrow-up-right" /></router-link>
    </div>
    <p v-if="articles && !tech.length" class="muted">Aucun article pour l'instant. Clique sur « Rafraîchir », ou lance <code>npm run fetch-feeds</code> en local.</p>
    <div v-if="big" class="veille-grid">
      <article class="big" :class="{ 'is-read': isRead(big.link) }">
        <a :href="big.link" target="_blank" rel="noopener" class="visual big-visual" tabindex="-1" aria-hidden="true" @click="markRead(big.link)">
          <img v-if="big.image" :src="big.image" alt="" loading="lazy" @error="$event.target.remove()" />
        </a>
        <div class="meta"><span class="label" style="color: var(--acct)">{{ big.themeName }}</span><span>{{ big.source }} · {{ dateShort(big.date) }}</span></div>
        <a :href="big.link" target="_blank" rel="noopener" class="big-h pretty" @click="markRead(big.link)">{{ big.title }}</a>
        <p v-if="big.summary" class="big-p">{{ big.summary }}</p>
        <button class="chk-wide" :aria-pressed="isRead(big.link)" @click="toggleRead(big.link)">
          <Icon name="check" :stroke="2.6" />{{ isRead(big.link) ? 'Lu' : 'Marquer comme lu' }}
        </button>
      </article>
      <div class="smalls">
        <article v-for="a in smalls" :key="a.link" class="small-card" :class="{ 'is-read': isRead(a.link) }">
          <a :href="a.link" target="_blank" rel="noopener" class="visual small-visual" tabindex="-1" aria-hidden="true" @click="markRead(a.link)">
            <img v-if="a.image" :src="a.image" alt="" loading="lazy" @error="$event.target.remove()" />
          </a>
          <div class="small-meta">
            <span class="label" :style="{ color: thCol(a) }">{{ a.themeName }}</span>
            <button class="chk" :aria-pressed="isRead(a.link)" :title="isRead(a.link) ? 'Marquer non lu' : 'Marquer comme lu'" @click="toggleRead(a.link)"><Icon name="check" :size="13" :stroke="2.8" /></button>
          </div>
          <a :href="a.link" target="_blank" rel="noopener" class="small-h pretty" @click="markRead(a.link)">{{ a.title }}</a>
          <span class="small muted">{{ a.source }} · {{ dateShort(a.date) }}</span>
        </article>
      </div>
    </div>
    <div v-if="texts.length" class="texts">
      <a v-for="a in texts" :key="a.link" :href="a.link" target="_blank" rel="noopener" class="text-link" @click="markRead(a.link)">
        <span class="label muted">{{ a.themeName }} · {{ a.source }}</span>
        <span class="text-t">{{ a.title }}</span>
      </a>
    </div>
  </section>

  <!-- Marchés · Révisions · Enquêtes -->
  <section class="cells">
    <div class="col">
      <div class="col-head"><router-link to="/trading" class="col-h">Marchés</router-link><span class="small muted">3 M · différé</span></div>
      <router-link v-for="m in assets.slice(0, 4)" :key="m.id" to="/trading" class="mk-row">
        <span class="mk-name"><span class="mk-n">{{ m.name }}</span><span class="small muted">{{ money(m.price, m.currency) }}</span></span>
        <svg width="96" height="32" viewBox="0 0 96 32" preserveAspectRatio="none" aria-hidden="true"><polyline :points="sparkPoints(m.series, 96, 32)" fill="none" :stroke="m.col" stroke-width="1.6" /></svg>
        <span class="mk-d" :style="{ color: m.col }">{{ m.d1s }}</span>
      </router-link>
      <p v-if="quotes === null" class="small muted">Aucune cotation pour l'instant.</p>
    </div>

    <div class="col col-flex">
      <router-link to="/quiz" class="col-h" style="margin-bottom: 16px">À réviser aujourd'hui</router-link>
      <div class="rev-big">
        <span class="rev-n">{{ bigCount }}</span>
        <span class="rev-l">{{ bigLabel }}<br />{{ sessions }} session{{ sessions > 1 ? 's' : '' }} de quiz</span>
      </div>
      <div class="rev-chips">
        <router-link v-for="t in reviseList" :key="t.id" :to="`/quiz/${t.id}`" class="rev-chip">{{ t.name }}</router-link>
      </div>
      <router-link to="/quiz/random" class="btn-ink" style="margin-top: auto">Quiz aléatoire tous thèmes<Icon name="arrow-right" :size="16" /></router-link>
    </div>

    <div class="col">
      <div class="col-head"><router-link to="/sql" class="col-h">Enquêtes SQL</router-link><span class="solved">{{ solved }} / {{ SQL_CASES.length }} résolues</span></div>
      <router-link v-for="(c, i) in SQL_CASES" :key="c.id" :to="`/sql/${c.id}`" class="case-row">
        <span class="case-n">{{ pad2(i + 1) }}</span><span class="case-t">{{ c.title }}</span><span class="label case-l" :style="{ color: LVL_COL[c.level] }">{{ c.level }}</span>
      </router-link>
    </div>
  </section>
</template>

<style scoped>
.hero-side { display: flex; flex-direction: column; gap: 20px; }
.lede { font-size: 22px; line-height: 1.3; font-weight: 500; }
.stats { display: flex; flex-wrap: wrap; gap: 8px 24px; font-size: 13px; color: var(--mut); }
.small { font-size: 12px; }

.ticker { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 2px; background: var(--rule); }
.tick { display: flex; flex-direction: column; gap: 6px; padding: 18px 24px; background: var(--bg); color: var(--ink); }
.tick:hover { background: var(--sf); color: var(--ink); }
.tk { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mut); }
.tv { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; }

.globe { flex: 7 1 560px; position: relative; min-height: 580px; cursor: grab; overflow: hidden; }
.globe-title { position: absolute; left: var(--pad); top: 32px; display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
.globe-h { font-size: 40px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
.globe-foot { position: absolute; left: var(--pad); right: var(--pad); bottom: 28px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; font-size: 12px; color: var(--mut); pointer-events: none; }

.story { flex: 5 1 380px; padding: 36px var(--pad); display: flex; flex-direction: column; }
.story-h { font-size: 38px; line-height: 1.04; letter-spacing: -0.03em; margin: 12px 0 16px; font-weight: 800; }
.story-p { font-size: 16px; line-height: 1.55; margin: 0 0 16px; color: var(--mut); }
.story-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
.story-list { display: flex; flex-direction: column; border-top: 2px solid var(--rule); flex: 1; }
.story-row { display: grid; grid-template-columns: 44px 1fr; gap: 12px; padding: 16px 0; border-bottom: 1px solid var(--hair); color: var(--ink); }
.story-n { font-size: 22px; font-weight: 800; color: var(--acc); }
.story-col { display: flex; flex-direction: column; gap: 4px; }
.story-t { font-size: 17px; font-weight: 600; line-height: 1.25; }

.veille { padding: 44px var(--pad) 40px; }
.sec-head { display: flex; flex-wrap: wrap; gap: 12px; align-items: baseline; justify-content: space-between; margin-bottom: 28px; }
.sec-h { font-size: clamp(40px, 5vw, 56px); letter-spacing: -0.04em; }
.sec-link { font-size: 14px; font-weight: 600; display: flex; gap: 8px; align-items: center; }
.veille-grid { display: flex; flex-wrap: wrap; gap: 32px 24px; }
.big { flex: 1 1 440px; min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.big-visual { aspect-ratio: 16 / 10; display: block; }
.meta { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; font-size: 12px; color: var(--mut); }
.big-h { font-size: 34px; line-height: 1.05; letter-spacing: -0.03em; font-weight: 800; color: var(--ink); }
.big-p { font-size: 16px; line-height: 1.5; color: var(--mut); }
.smalls { flex: 1 1 440px; min-width: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(max(200px, calc(50% - 12px)), 1fr)); gap: 32px 24px; align-content: start; }
.small-card { display: flex; flex-direction: column; gap: 10px; }
.small-visual { aspect-ratio: 16 / 10; display: block; }
.small-meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.small-h { font-size: 19px; line-height: 1.18; letter-spacing: -0.015em; font-weight: 700; color: var(--ink); }
.texts { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; margin-top: 36px; padding-top: 20px; border-top: 2px solid var(--rule); }
.text-link { display: flex; flex-direction: column; gap: 8px; color: var(--ink); }
.text-t { font-size: 16px; font-weight: 600; line-height: 1.3; }

.col { flex: 1 1 340px; padding: 36px var(--pad) 40px; }
.col-flex { display: flex; flex-direction: column; }
.col-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 20px; }
.col-h { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
.mk-row { display: grid; grid-template-columns: 1fr 96px 84px; gap: 12px; align-items: center; padding: 12px 0; border-top: 1px solid var(--hair); color: var(--ink); }
.mk-name { display: flex; flex-direction: column; }
.mk-n { font-size: 14px; font-weight: 600; }
.mk-d { text-align: right; font-size: 15px; font-weight: 800; }
.rev-big { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; }
.rev-n { font-size: 72px; font-weight: 800; line-height: 0.9; letter-spacing: -0.05em; color: var(--acc); }
.rev-l { font-size: 15px; color: var(--mut); line-height: 1.3; }
.rev-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; }
.rev-chip { font-size: 13px; padding: 5px 9px; border: 1px solid var(--rule); color: var(--ink); }
.rev-chip:hover { background: var(--ink); color: var(--bg); }
.solved { font-size: 13px; font-weight: 600; }
.case-row { display: grid; grid-template-columns: 28px 1fr auto; gap: 10px; align-items: baseline; padding: 11px 0; border-top: 1px solid var(--hair); color: var(--ink); }
.case-n { font-size: 12px; font-weight: 800; color: var(--mut); }
.case-t { font-size: 15px; font-weight: 600; }
.case-l { font-weight: 600; letter-spacing: 0.05em; }
</style>
