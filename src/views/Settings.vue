<script setup>
import { ref } from 'vue'
import Icon from '../components/Icon.vue'
import { state, exportProgress, importProgress } from '../stores/progress.js'
import { pullProgress, pushProgress, syncConfigured } from '../lib/github.js'

const message = ref('')
const failed = ref(false)
const busy = ref(false)

async function run(fn) {
  busy.value = true
  const r = await fn().catch((e) => ({ ok: false, message: e.message }))
  message.value = r.message
  failed.value = !r.ok
  busy.value = false
}

function exportJson() {
  const blob = new Blob([JSON.stringify(exportProgress(), null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'devwatch-progress.json'
  a.click()
}

function importJson(event) {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      importProgress(JSON.parse(reader.result))
      message.value = 'Progression importée.'
      failed.value = false
    } catch {
      message.value = "Fichier JSON invalide : il doit venir d'un export DevWatch."
      failed.value = true
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <section class="page-hero">
    <div>
      <div class="kicker">Synchronisation · rappels · sauvegarde</div>
      <h1 class="hero-title" style="margin-top: 18px">Para&shy;mètres<span class="dot">.</span></h1>
    </div>
    <p class="intro pretty">Ta progression vit dans ce navigateur. La synchroniser sur GitHub permet de recevoir les rappels du matin et d'utiliser le bouton « Rafraîchir ».</p>
  </section>

  <section class="cells band">
    <div class="block wide">
      <h2 class="h">Synchronisation GitHub</h2>
      <p class="p">
        La progression est poussée dans <code class="code-inline">progress/progress.json</code> de ton repo ; le workflow
        <code class="code-inline">reminders.yml</code> la lit pour t'envoyer les rappels. Crée un
        <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener" class="link">token fine-grained</a>
        limité à ce repo, avec les permissions <strong>Contents : Read and write</strong> (progression) et
        <strong>Actions : Read and write</strong> (bouton « Rafraîchir »).
      </p>
      <div class="form">
        <label>Propriétaire (owner)<input v-model="state.settings.githubOwner" class="field" placeholder="ton-pseudo-github" /></label>
        <label>Nom du repo<input v-model="state.settings.githubRepo" class="field" placeholder="watchdev" /></label>
        <label>Branche<input v-model="state.settings.githubBranch" class="field" placeholder="main" /></label>
        <label>Token (stocké uniquement dans ce navigateur)<input v-model="state.settings.githubToken" type="password" class="field" placeholder="github_pat_…" /></label>
      </div>
      <div class="btns">
        <button class="go acc" :disabled="!syncConfigured() || busy" @click="run(pushProgress)">Pousser la progression<Icon name="arrow-up-right" /></button>
        <button class="btn-outline" style="height: 46px" :disabled="!syncConfigured() || busy" @click="run(pullProgress)">Récupérer la progression</button>
      </div>
      <p v-if="state.lastSync" class="small">Dernière synchronisation : {{ new Date(state.lastSync).toLocaleString('fr-FR') }}</p>
    </div>

    <div class="block">
      <h2 class="h">Rappels par mail</h2>
      <label>Ton adresse email<input v-model="state.settings.email" type="email" class="field" placeholder="toi@exemple.fr" /></label>
      <p class="p">
        L'adresse part avec <code class="code-inline">progress.json</code> lors de la synchronisation. Chaque matin, si des thèmes sont dus
        ou jamais testés, tu reçois un récapitulatif. Le serveur SMTP se configure dans les <strong>secrets du repo GitHub</strong>
        (voir le README), jamais dans le navigateur.
      </p>
    </div>

    <div class="block">
      <h2 class="h">Sauvegarde locale</h2>
      <p class="p">Un fichier JSON avec tes thèmes et tes enquêtes, sans le token.</p>
      <div class="btns">
        <button class="btn-outline" style="height: 46px" @click="exportJson">Exporter en JSON</button>
        <label class="btn-outline import">Importer un JSON<input type="file" accept=".json" class="sr" @change="importJson" /></label>
      </div>
    </div>
  </section>

  <p v-if="message" class="msg" :class="{ failed }" aria-live="polite">{{ message }}</p>
</template>

<style scoped>
.intro { font-size: 17px; line-height: 1.5; }
.block { flex: 1 1 340px; padding: 36px var(--pad) 40px; display: flex; flex-direction: column; gap: 16px; }
.block.wide { flex: 2 1 560px; }
.h { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
.p { font-size: 15px; line-height: 1.55; color: var(--mut); max-width: 640px; }
.p strong { color: var(--ink); }
.link { color: var(--acc); font-weight: 600; }
.form { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px 20px; }
label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: var(--mut); }
label .field { width: 100%; }
.btns { display: flex; gap: 10px; flex-wrap: wrap; }
.go { height: 46px; padding: 0 16px; display: flex; align-items: center; gap: 10px; border: 0; font-size: 14px; font-weight: 800; }
.go.acc { background: var(--acc); color: var(--onacc); }
.import { height: 46px; cursor: pointer; flex-direction: row; color: var(--ink); font-size: 13px; }
.import:hover { color: var(--bg); }
.sr { position: absolute; width: 1px; height: 1px; opacity: 0; }
.small { font-size: 12px; color: var(--mut); }
.msg { padding: 16px var(--pad); font-size: 14px; font-weight: 600; border-bottom: 2px solid var(--rule); }
.msg.failed { background: var(--acc); color: var(--onacc); }
</style>
