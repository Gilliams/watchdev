<script setup>
import { ref } from 'vue'
import { state, exportProgress, importProgress } from '../stores/progress.js'
import { pullProgress, pushProgress, syncConfigured } from '../lib/github.js'

const message = ref('')
const busy = ref(false)

async function doPull() {
  busy.value = true
  const r = await pullProgress().catch((e) => ({ ok: false, message: e.message }))
  message.value = (r.ok ? '✅ ' : '❌ ') + r.message
  busy.value = false
}

async function doPush() {
  busy.value = true
  const r = await pushProgress().catch((e) => ({ ok: false, message: e.message }))
  message.value = (r.ok ? '✅ ' : '❌ ') + r.message
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
      message.value = '✅ Progression importée'
    } catch {
      message.value = '❌ Fichier JSON invalide'
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <h1>⚙️ Paramètres</h1>
  <p class="subtitle">Synchronisation GitHub et rappels par mail.</p>

  <div class="card">
    <h2 style="margin-top: 0">☁️ Synchronisation GitHub</h2>
    <p class="small muted">
      Ta progression est poussée dans <code>progress/progress.json</code> de ton repo. C'est ce fichier
      que lit le workflow <code>reminders.yml</code> pour t'envoyer les rappels Ebbinghaus par mail.
      Crée un <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">token fine-grained</a>
      limité à ce repo avec les permissions <strong>Contents : Read and write</strong> (progression) et
      <strong>Actions : Read and write</strong> (bouton « 🔄 Rafraîchir »).
    </p>
    <div class="grid">
      <div>
        <label>Propriétaire (owner)</label>
        <input type="text" v-model="state.settings.githubOwner" placeholder="ton-pseudo-github" />
        <label>Nom du repo</label>
        <input type="text" v-model="state.settings.githubRepo" placeholder="devwatch" />
      </div>
      <div>
        <label>Branche</label>
        <input type="text" v-model="state.settings.githubBranch" placeholder="main" />
        <label>Token (stocké uniquement dans TON navigateur)</label>
        <input type="password" v-model="state.settings.githubToken" placeholder="github_pat_…" />
      </div>
    </div>
    <div class="flex mt">
      <button class="primary" :disabled="!syncConfigured() || busy" @click="doPush">⬆️ Pousser la progression</button>
      <button :disabled="!syncConfigured() || busy" @click="doPull">⬇️ Récupérer la progression</button>
    </div>
    <p v-if="state.lastSync" class="small muted">Dernier sync : {{ new Date(state.lastSync).toLocaleString('fr-FR') }}</p>
  </div>

  <div class="card">
    <h2 style="margin-top: 0">📧 Rappels par mail (courbe d'Ebbinghaus)</h2>
    <label>Ton adresse email</label>
    <input type="email" v-model="state.settings.email" placeholder="toi@exemple.fr" style="max-width: 320px" />
    <p class="small muted mt">
      L'email est embarqué dans <code>progress.json</code> lors du sync. Le workflow GitHub
      <code>reminders.yml</code> tourne chaque matin : si des thèmes sont dus (ou jamais testés),
      tu reçois un mail récapitulatif. La configuration SMTP se fait dans les
      <strong>secrets du repo GitHub</strong> (voir le README) — jamais dans le navigateur.
    </p>
  </div>

  <div class="card">
    <h2 style="margin-top: 0">💾 Sauvegarde locale</h2>
    <div class="flex">
      <button @click="exportJson">⬇️ Exporter en JSON</button>
      <label class="btn" style="margin: 0; cursor: pointer">
        ⬆️ Importer un JSON
        <input type="file" accept=".json" @change="importJson" style="display: none" />
      </label>
    </div>
  </div>

  <p v-if="message" class="mt">{{ message }}</p>
</template>
