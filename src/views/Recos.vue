<script setup>
// Recommandations YouTube : vidéos récentes des chaînes de scripts/youtube.json,
// classées par surperformance (vues vs audience habituelle de la chaîne), likes et fraîcheur.
import { ref, computed, onMounted } from 'vue'
import Icon from '../components/Icon.vue'
import { loadData } from '../lib/data.js'
import { isRead, toggleRead, markRead } from '../lib/read.js'
import { dateTime } from '../lib/format.js'

const data = ref(null)
const loading = ref(true)
const cat = ref('all')
const hide = ref(false)
const fr = ref(false)
const playing = ref(null)

onMounted(async () => {
  data.value = await loadData('videos')
  loading.value = false
})

const videos = computed(() => data.value?.videos || [])
const visible = computed(() => videos.value.filter((v) => (!hide.value || !isRead(v.url)) && (!fr.value || v.lang === 'fr')))
const picks = computed(() => (cat.value === 'all' ? visible.value.slice(0, 3) : []))
const list = computed(() => {
  const l = visible.value.filter((v) => cat.value === 'all' || v.category === cat.value)
  return cat.value === 'all' ? l.slice(3) : l
})
const chips = computed(() => [
  { id: 'all', l: 'Tout', n: videos.value.length },
  ...(data.value?.categories || []).map((c) => ({ id: c.id, l: c.name, n: videos.value.filter((v) => v.category === c.id).length })),
])
const channelCount = computed(() => new Set(videos.value.map((v) => v.handle)).size)

const compact = (n) => new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
function age(d) {
  const h = (Date.now() - new Date(d).getTime()) / 3600000
  if (h < 24) return `il y a ${Math.max(1, Math.round(h))} h`
  const j = Math.round(h / 24)
  return `il y a ${j} j`
}
const perfLabel = (v) => (v.perf >= 1.5 ? `×${v.perf.toFixed(1).replace('.', ',')} son audience habituelle` : '')
function play(v) {
  playing.value = playing.value === v.id ? null : v.id
  markRead(v.url)
}
</script>

<template>
  <section class="page-hero">
    <div>
      <div class="kicker">
        <template v-if="data?.generatedAt">Dernier relevé : {{ dateTime(data.generatedAt) }} · {{ channelCount }} chaînes</template>
        <template v-else>YouTube · flux publics</template>
      </div>
      <h1 class="hero-title" style="margin-top: 18px">Recom&shy;mandations<span class="dot">.</span></h1>
    </div>
    <p class="intro pretty">
      Les vidéos récentes (30 jours, sans les Shorts) des chaînes que tu suis, classées par surperformance : une vidéo qui fait trois fois l'audience
      habituelle de sa chaîne passe devant une vidéo moyenne d'une grosse chaîne. Les likes et la fraîcheur départagent.
    </p>
  </section>

  <section class="filters band">
    <div class="chips">
      <button v-for="c in chips" :key="c.id" class="chip" :class="{ empty: !c.n && cat !== c.id }" :aria-pressed="cat === c.id" @click="cat = c.id">{{ c.l }}<span class="chip-n">{{ c.n }}</span></button>
    </div>
    <div class="row">
      <button class="toggle" :aria-pressed="fr" @click="fr = !fr">Français uniquement</button>
      <button class="toggle" :aria-pressed="hide" @click="hide = !hide">Masquer les vues</button>
    </div>
  </section>

  <p v-if="loading" class="empty">Chargement…</p>
  <p v-else-if="!videos.length" class="empty">Aucune vidéo pour l'instant. Clique sur « Rafraîchir », ou en local : <code>npm run fetch-youtube</code>.</p>

  <template v-else>
    <section v-if="picks.length" class="picks band">
      <h2 class="sec-h">À ne pas rater</h2>
      <div class="pick-grid">
        <article v-for="v in picks" :key="v.id" class="vid big" :class="{ 'is-read': isRead(v.url) && playing !== v.id }">
          <div class="visual thumb">
            <iframe v-if="playing === v.id" :src="`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1`" title="Lecteur YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
            <button v-else class="play" :aria-label="`Lire ${v.title}`" @click="play(v)">
              <img referrerpolicy="no-referrer" :src="v.thumb" alt="" loading="lazy" @error="$event.target.remove()" />
              <span class="play-i"><Icon name="arrow-up-right" :size="18" :stroke="2.4" /></span>
            </button>
          </div>
          <span v-if="perfLabel(v)" class="perf">{{ perfLabel(v) }}</span>
          <a :href="v.url" target="_blank" rel="noopener" class="vid-h pretty" @click="markRead(v.url)">{{ v.title }}</a>
          <p v-if="v.description" class="vid-d">{{ v.description }}</p>
          <div class="vid-m">
            <span>{{ v.channel }} · {{ age(v.published) }} · {{ compact(v.views) }} vues</span>
            <button class="chk" :aria-pressed="isRead(v.url)" :title="isRead(v.url) ? 'Marquer non vue' : 'Marquer comme vue'" @click="toggleRead(v.url)"><Icon name="check" :size="13" :stroke="2.8" /></button>
          </div>
        </article>
      </div>
    </section>

    <section class="grid band">
      <article v-for="v in list" :key="v.id" class="vid" :class="{ 'is-read': isRead(v.url) && playing !== v.id }">
        <div class="visual thumb">
          <iframe v-if="playing === v.id" :src="`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1`" title="Lecteur YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
          <button v-else class="play" :aria-label="`Lire ${v.title}`" @click="play(v)">
            <img referrerpolicy="no-referrer" :src="v.thumb" alt="" loading="lazy" @error="$event.target.remove()" />
            <span class="lang">{{ v.lang === 'fr' ? 'FR' : 'EN' }}</span>
          </button>
        </div>
        <span v-if="perfLabel(v)" class="perf">{{ perfLabel(v) }}</span>
        <a :href="v.url" target="_blank" rel="noopener" class="vid-h pretty" @click="markRead(v.url)">{{ v.title }}</a>
        <div class="vid-m">
          <span>{{ v.channel }} · {{ age(v.published) }} · {{ compact(v.views) }} vues</span>
          <button class="chk" :aria-pressed="isRead(v.url)" :title="isRead(v.url) ? 'Marquer non vue' : 'Marquer comme vue'" @click="toggleRead(v.url)"><Icon name="check" :size="13" :stroke="2.8" /></button>
        </div>
      </article>
    </section>
    <p v-if="!list.length && !picks.length" class="empty">Aucune vidéo ne correspond aux filtres.</p>
    <p class="foot">Ajoute ou retire une chaîne dans <code>scripts/youtube.json</code> (son @handle suffit).<template v-if="data.errors?.length"> Chaînes non relevées : {{ data.errors.map((e) => e.split(':')[0]).join(', ') }}.</template></p>
  </template>
</template>

<style scoped>
.intro { font-size: 16px; line-height: 1.5; color: var(--mut); }
.filters { padding: 20px var(--pad); display: flex; flex-direction: column; gap: 14px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { height: 32px; padding: 0 11px; border: 1px solid var(--rule); background: transparent; color: var(--ink); font-size: 13px; font-weight: 600; display: flex; gap: 7px; align-items: center; }
.chip[aria-pressed='true'] { border: 2px solid var(--ink); background: var(--ink); color: var(--bg); }
.chip.empty { opacity: 0.45; }
.chip-n { font-size: 11px; font-weight: 700; opacity: 0.7; }
.row { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; }

.picks { padding: 28px var(--pad) 36px; }
.sec-h { font-size: clamp(32px, 4vw, 48px); letter-spacing: -0.04em; margin-bottom: 20px; }
.pick-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); border-top: 2px solid var(--rule); border-left: 2px solid var(--rule); }
.pick-grid .vid { border-right: 2px solid var(--rule); border-bottom: 2px solid var(--rule); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
.grid .vid { border-right: 2px solid var(--rule); border-bottom: 2px solid var(--rule); }

.vid { background: var(--bg); padding: 16px 16px 20px; display: flex; flex-direction: column; gap: 10px; }
.vid.big { padding: 20px 20px 24px; gap: 12px; }
.thumb { aspect-ratio: 16 / 9; display: block; }
.thumb iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.play { position: absolute; inset: 0; padding: 0; border: 0; background: transparent; cursor: pointer; }
.play-i { position: absolute; right: 10px; bottom: 10px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; background: var(--acc); color: var(--onacc); }
.lang { position: absolute; right: 10px; bottom: 10px; font: 700 11px var(--font); color: var(--ink); background: var(--bg); padding: 1px 5px; }
.perf { align-self: flex-start; font-size: 11px; font-weight: 800; color: var(--onacc); background: var(--acc); padding: 2px 6px; }
.vid-h { font-size: 18px; line-height: 1.2; letter-spacing: -0.015em; font-weight: 700; color: var(--ink); }
.big .vid-h { font-size: clamp(20px, 2vw, 26px); }
.vid-d { font-size: 14px; line-height: 1.45; color: var(--mut); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.vid-m { margin-top: auto; display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; color: var(--mut); }
.foot { font-size: 13px; color: var(--mut); padding: 24px var(--pad) 48px; }
</style>
