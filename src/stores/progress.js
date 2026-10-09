import { reactive, watch } from 'vue'

const STORAGE_KEY = 'devwatch-progress-v1'

// État global de l'appli, persisté en localStorage et synchronisable sur GitHub.
export const state = reactive({
  // { [themeId]: { level, lastReview, nextReview, history: [{date, score, total}] } }
  themes: {},
  // { [caseId]: { solvedSteps: [indices], solved: bool, hintsUsed: n } }
  sqlCases: {},
  readArticles: [], // liens des articles marqués lus
  readDigest: [], // titres des sujets de « L'actu en 5 min » marqués lus
  settings: {
    githubOwner: '',
    githubRepo: '',
    githubBranch: 'main',
    githubToken: '',
    email: '',
  },
  lastSync: null,
})

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      Object.assign(state.themes, saved.themes || {})
      Object.assign(state.sqlCases, saved.sqlCases || {})
      state.readArticles = saved.readArticles || []
      state.readDigest = saved.readDigest || []
      Object.assign(state.settings, saved.settings || {})
      state.lastSync = saved.lastSync || null
    }
  } catch (e) {
    console.error('Impossible de charger la progression locale', e)
  }

  watch(state, persist, { deep: true })
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// Contenu envoyé sur GitHub (sans le token !)
export function exportProgress() {
  return {
    themes: state.themes,
    sqlCases: state.sqlCases,
    email: state.settings.email,
    updatedAt: new Date().toISOString(),
  }
}

export function importProgress(data) {
  if (data.themes) Object.assign(state.themes, data.themes)
  if (data.sqlCases) Object.assign(state.sqlCases, data.sqlCases)
  if (data.email && !state.settings.email) state.settings.email = data.email
}
