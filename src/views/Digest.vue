<script setup>
import { ref, computed, onMounted } from 'vue'
import Icon from '../components/Icon.vue'
import { state } from '../stores/progress.js'
import { loadData } from '../lib/data.js'
import { theme } from '../lib/theme.js'
import { pad2, longDate, hoursAgo } from '../lib/format.js'

const digest = ref(null)
const loading = ref(true)

onMounted(async () => {
  digest.value = await loadData('digest')
  loading.value = false
})

const isRead = (key) => state.readDigest.includes(key)
function toggle(key) {
  const i = state.readDigest.indexOf(key)
  if (i >= 0) state.readDigest.splice(i, 1)
  else state.readDigest.push(key)
}

// Ancres internes : le routeur est en mode hash, on fait défiler sans toucher à l'URL
const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const sections = computed(() => {
  let k = 0
  return (digest.value?.sections || []).map((s) => ({
    ...s,
    id: slug(s.title),
    items: s.items.map((it) => {
      const c = it.coverage || it.sources?.length || 1
      return { ...it, n: pad2(++k), cov: c > 1 ? `${c} médias` : '1 média', strong: c >= 3 }
    }),
  }))
})
const keys = computed(() => sections.value.flatMap((s) => s.items.map((it) => it.title)))
const total = computed(() => keys.value.length)
const readCount = computed(() => keys.value.filter(isRead).length)
const allRead = computed(() => total.value > 0 && readCount.value === total.value)

function markAll() {
  if (allRead.value) state.readDigest = state.readDigest.filter((k) => !keys.value.includes(k))
  else for (const k of keys.value) if (!isRead(k)) state.readDigest.push(k)
}
</script>

<template>
  <section class="hero band">
    <dw-wave class="scene" :theme="theme"></dw-wave>
    <div class="hero-in">
      <div class="hero-left">
        <div class="kicker">
          {{ longDate(digest?.generatedAt || Date.now()) }}<template v-if="digest"> — générée {{ hoursAgo(digest.generatedAt) }} à partir de {{ digest.articleCount }} dépêches</template>
        </div>
        <h1 class="hero-title" style="margin-top: 18px">L'actu<br />en {{ digest?.readingMinutes || 5 }} min<span class="dot">.</span></h1>
      </div>
      <p class="hero-p pretty">Les sujets des dernières 30 h, regroupés par événement : plus il y a de rédactions qui le couvrent, plus il remonte.</p>
    </div>
  </section>

  <p v-if="loading" class="empty">Chargement…</p>
  <p v-else-if="!digest" class="empty">
    Aucun résumé pour l'instant. Clique sur « Rafraîchir », ou en local : <code>npm run fetch-feeds &amp;&amp; npm run build-digest</code>.
  </p>

  <template v-else>
    <section class="essentiel band">
      <div class="ess-k">L'essentiel</div>
      <p class="ess-p pretty">{{ digest.headline }}</p>
    </section>

    <div class="layout">
      <aside class="side">
        <div class="prog">
          <div class="prog-head"><span>Progression</span><span>{{ readCount }} / {{ total }} lus</span></div>
          <div class="prog-bar"><div :style="{ width: total ? `${Math.round((readCount / total) * 100)}%` : '0%' }"></div></div>
        </div>
        <nav class="side-nav" aria-label="Sections">
          <a v-for="s in sections" :key="s.id" :href="`#${s.id}`" @click.prevent="goTo(s.id)">
            <span>{{ s.title }}</span><span class="count">{{ s.items.length }}</span>
          </a>
        </nav>
        <button class="mark-all" @click="markAll">{{ allRead ? 'Tout marquer non lu' : 'Tout marquer comme lu' }}</button>
      </aside>

      <main class="main">
        <section v-for="s in sections" :id="s.id" :key="s.id" class="sec">
          <div class="sec-head"><h2 class="sec-h">{{ s.title }}</h2><span class="sec-c">{{ s.items.length }} sujets</span></div>
          <article v-for="it in s.items" :key="it.title" class="item" :class="{ faded: isRead(it.title) }">
            <span class="item-n">{{ it.n }}</span>
            <div class="item-body">
              <div class="item-meta">
                <span class="cov" :class="{ strong: it.strong }">{{ it.cov }}</span>
                <span v-if="it.date" class="time">{{ hoursAgo(it.date) }}</span>
              </div>
              <h3 class="item-h pretty">{{ it.title }}</h3>
              <p class="item-p pretty">{{ it.body }}</p>
              <div class="item-foot">
                <div class="srcs">
                  <a v-for="src in it.sources" :key="src.link" :href="src.link" target="_blank" rel="noopener" :title="src.title" class="src">{{ src.source }}</a>
                </div>
                <button class="chk-wide" :aria-pressed="isRead(it.title)" @click="toggle(it.title)">
                  <Icon name="check" :size="13" :stroke="2.8" />{{ isRead(it.title) ? 'Lu' : 'Marquer comme lu' }}
                </button>
              </div>
            </div>
          </article>
        </section>
        <p class="note">
          {{ digest.method === 'extractif'
            ? 'Sélection automatique : chaque sujet est présenté par le chapô de la dépêche la plus représentative.'
            : `Textes reformulés par ${digest.method} à partir des titres et chapôs.` }}
          Recoupe avec les sources avant de reprendre une information.
        </p>
      </main>
    </div>
  </template>
</template>

<style scoped>
.hero { position: relative; min-height: 440px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
.hero-in { position: relative; padding: 44px var(--pad) 36px; display: flex; flex-wrap: wrap; gap: 24px 48px; align-items: flex-end; pointer-events: none; }
.hero-left { flex: 2 1 520px; min-width: 0; }
.hero-p { flex: 1 1 300px; font-size: 17px; line-height: 1.45; color: var(--mut); }

.essentiel { padding: 40px var(--pad); background: var(--acc); color: var(--onacc); transition: background 0.4s; }
.ess-k { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 14px; }
.ess-p { font-size: clamp(26px, 3.2vw, 42px); line-height: 1.12; letter-spacing: -0.025em; font-weight: 700; max-width: 1100px; }

.layout { display: flex; flex-wrap: wrap; align-items: flex-start; }
.side { flex: 0 1 260px; position: sticky; top: 0; padding: 36px var(--pad); display: flex; flex-direction: column; gap: 20px; }
.prog { display: flex; flex-direction: column; gap: 8px; }
.prog-head { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; }
.prog-bar { height: 6px; background: var(--hair); position: relative; }
.prog-bar > div { position: absolute; left: 0; top: 0; bottom: 0; background: var(--acc); transition: width 0.4s; }
.side-nav { display: flex; flex-direction: column; border-top: 2px solid var(--rule); }
.side-nav a { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 0; border-bottom: 1px solid var(--hair); font-size: 16px; font-weight: 700; color: var(--ink); }
.side-nav a:hover { color: var(--acc); }
.count { font-size: 12px; font-weight: 600; color: var(--mut); }
.mark-all { height: 40px; padding: 0 14px; background: transparent; color: var(--ink); border: 2px solid var(--ink); font-size: 13px; font-weight: 600; text-align: left; }
.mark-all:hover { background: var(--ink); color: var(--bg); }

.main { flex: 1 1 560px; min-width: 0; border-left: 2px solid var(--rule); }
.sec { padding: 36px clamp(20px, 3vw, 48px) 12px; scroll-margin-top: 12px; }
.sec-head { display: flex; align-items: baseline; gap: 16px; margin-bottom: 8px; }
.sec-h { font-size: clamp(40px, 5vw, 64px); letter-spacing: -0.045em; line-height: 1; }
.sec-c { font-size: 13px; color: var(--mut); }
.item { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 16px; padding: 28px 0; border-top: 2px solid var(--rule); }
.item.faded { opacity: 0.45; }
.item-n { font-size: 28px; font-weight: 800; color: var(--acc); letter-spacing: -0.03em; line-height: 1; }
.item-body { display: flex; flex-direction: column; gap: 12px; max-width: 760px; }
.item-meta { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.cov { font-size: 12px; font-weight: 800; padding: 3px 8px; background: transparent; color: var(--ink); }
.cov.strong { background: var(--acc); color: var(--onacc); }
.time { font-size: 12px; color: var(--mut); }
.item-h { font-size: clamp(24px, 2.6vw, 32px); line-height: 1.08; letter-spacing: -0.025em; font-weight: 800; }
.item-p { font-size: 18px; line-height: 1.6; }
.item-foot { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.srcs { display: flex; flex-wrap: wrap; gap: 6px; }
.src { font-size: 12px; padding: 4px 9px; border: 1px solid var(--rule); color: var(--ink); }
.src:hover { background: var(--ink); color: var(--bg); }
.item-foot .chk-wide { height: 32px; font-size: 12px; align-self: auto; }
.note { font-size: 13px; line-height: 1.5; color: var(--mut); padding: 24px clamp(20px, 3vw, 48px) 48px; border-top: 2px solid var(--rule); max-width: 760px; }
</style>
